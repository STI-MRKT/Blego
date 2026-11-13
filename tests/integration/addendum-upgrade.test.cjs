const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { openStore } = require('../../electron/local/store.cjs');
const { generateProfile } = require('../../electron/features/generator/service.cjs');
const { createArchiveService } = require('../../electron/features/archive/service.cjs');
for (const baseline of ['211d2a2', 'aeb8c237780088d33a1ac8c2f05549144088d192'])
  test(`upgrade actual ${baseline} store: ZIP, registry, last card, presets, notes and settings survive`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-upgrade-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const oldCode = path.join(root, 'old-code');
    fs.mkdirSync(oldCode);
    const archive = path.join(root, 'code.tar');
    fs.writeFileSync(
      archive,
      execFileSync('git', ['archive', baseline], { maxBuffer: 32 * 1024 * 1024 })
    );
    execFileSync('tar', ['-xf', archive, '-C', oldCode]);
    fs.symlinkSync(path.resolve('node_modules'), path.join(oldCode, 'node_modules'), 'dir');
    const original = path.join(root, 'old-data'),
      cloned = path.join(root, 'upgraded-data');
    const oldStore = await require(path.join(oldCode, 'electron/local/store.cjs')).openStore(
      original
    );
    const settings = require(path.join(oldCode, 'electron/local/settings.cjs')).updateSettings(
      oldStore,
      { country: 'PL', type: 'tech', symbols: '★', newsEnabled: false, includeOriginal: true }
    );
    const card = await require(
      path.join(oldCode, 'electron/features/generator/service.cjs')
    ).generateProfile(
      { country: 'PL', type: 'tech', requestId: 'pre-addendum-card' },
      { store: oldStore }
    );
    const cls = require(
      path.join(oldCode, 'electron/features/classification/service.cjs')
    ).createClassificationService({ allowTestRules: true });
    const { parseInput } = await import(path.join(oldCode, 'shared/importer.mjs'));
    const parsed = await parseInput({
      bytes: Buffer.from('Synthetic historical source'),
      originalName: 'TEST-ONLY-old.txt'
    });
    const preview = cls.classifyDocument(parsed, {
      testOnly: true,
      version: 'TEST-ONLY-UPGRADE',
      classify: (r) => r.data.text
    });
    cls.confirmClassification(preview.operationId, 'accept_complete');
    const oldArchives = require(
      path.join(oldCode, 'electron/features/archive/service.cjs')
    ).createArchiveService({ store: oldStore, classification: cls });
    await oldArchives.saveArchive(preview.operationId);
    const entry = oldArchives.listArchives().items[0],
      zip = path.join(entry.archiveRoot, entry.fileName),
      zipHash = createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    const issued = oldStore.db.prepare('SELECT * FROM issued ORDER BY field,scope,value').all();
    let oldPresets, oldNotes;
    if (baseline.startsWith('aeb8')) {
      const images = require(
        path.join(oldCode, 'electron/features/images/service.cjs')
      ).createImageService({ store: oldStore });
      images.importPreset({
        schemaVersion: 1,
        name: 'Historical manual preset',
        operations: [{ field: 'title', action: 'set', value: 'Synthetic historical title' }]
      });
      const fb = require(
        path.join(oldCode, 'electron/features/facebook/service.cjs')
      ).createFacebookService({ store: oldStore });
      fb.saveManualNote({
        targetKey: '1234567890123456789',
        status: 'not_checked',
        comment: 'Synthetic upgrade note'
      });
      oldPresets = oldStore.get('metadata:presets');
      oldNotes = fb.notes('1234567890123456789');
    }
    oldStore.close();
    cls.close();
    fs.cpSync(original, cloned, { recursive: true });
    // Stored archive locations remain explicit; both directories are synthetic copies in this test.
    const store = await openStore(cloned);
    try {
      assert.deepEqual(store.get('lastCard'), card);
      if (oldPresets) {
        assert.deepEqual(store.get('metadata:presets'), oldPresets);
        const images = require('../../electron/features/images/service.cjs').createImageService({
          store
        });
        assert.equal(
          images.presets().find((p) => p.name === 'Historical manual preset').operations[0].value,
          'Synthetic historical title'
        );
        assert.deepEqual(
          require('../../electron/features/facebook/service.cjs')
            .createFacebookService({ store })
            .notes('1234567890123456789'),
          oldNotes
        );
        assert.deepEqual(images.groups.snapshot().membership, {});
      }
      assert.deepEqual(
        require('../../electron/local/settings.cjs').getSettings(store).symbols,
        settings.symbols
      );
      assert.deepEqual(
        store.db.prepare('SELECT * FROM issued ORDER BY field,scope,value').all(),
        issued
      );
      assert.deepEqual(
        await generateProfile(
          { country: 'PL', type: 'tech', requestId: 'pre-addendum-card' },
          { store }
        ),
        card
      );
      const archives = createArchiveService({ store });
      const view = await archives.openArchive(entry.archiveId);
      assert.equal(view.entries['result.txt'].toString(), 'Synthetic historical source');
      assert.equal(createHash('sha256').update(fs.readFileSync(zip)).digest('hex'), zipHash);
      const next = await generateProfile(
        { country: 'PL', type: 'tech', requestId: 'post-addendum-card' },
        { store }
      );
      assert.notEqual(next.fields.phone, card.fields.phone);
      assert.notEqual(next.fields.email, card.fields.email);
      assert.equal(next.nameGender, null);
      assert.equal(next.namingStrategy, 'brand_name');
    } finally {
      store.close();
    }
  });
