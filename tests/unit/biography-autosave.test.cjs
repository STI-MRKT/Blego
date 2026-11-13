const { test } = require('node:test');
const assert = require('node:assert/strict');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
async function editor(save, extra = {}) {
  const { createBiographyEditor } = await import('../../src/js/services/biography.js');
  return createBiographyEditor(
    {
      profileId: 'p',
      revision: 0,
      values: { employer: 'Company', position: 'Role', mainBio: 'before' },
      institutions: []
    },
    { save, delay: 10, ...extra }
  );
}
test('autosave debounces edits, announces saved only after persistence, and preserves typing in flight', async () => {
  const first = deferred(),
    calls = [],
    saved = [];
  const e = await editor(
    (r) => {
      calls.push(r);
      return calls.length === 1
        ? first.promise
        : Promise.resolve({ id: 'p', biographyRevision: 2, biography: r.values });
    },
    { onSaved: (p) => saved.push(p) }
  );
  e.update({ mainBio: 'one' });
  e.update({ mainBio: 'two' });
  assert.equal(calls.length, 0);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.mainBio, 'two');
  assert.equal(saved.length, 0);
  assert.equal(e.saving, true);
  e.update({ mainBio: 'three' });
  first.resolve({ id: 'p', biographyRevision: 1, biography: calls[0].values });
  await e.flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].revision, 1);
  assert.equal(calls[1].values.mainBio, 'three');
  assert.equal(e.values.mainBio, 'three');
  assert.equal(e.dirty, false);
  assert.equal(saved.length, 2);
  e.dispose();
});
test('write failure retains draft and revision, flush rejects, retry commits once', async () => {
  let fail = true,
    count = 0;
  const e = await editor(async (r) => {
    count++;
    if (fail) throw Error('SQLITE_FULL');
    return { id: 'p', biographyRevision: 1, biography: r.values };
  });
  e.update({ mainBio: 'retained' });
  await assert.rejects(e.flush(), /SQLITE_FULL/);
  assert.equal(e.values.mainBio, 'retained');
  assert.equal(e.revision, 0);
  assert.equal(e.dirty, true);
  assert.equal(e.error, true);
  fail = false;
  await e.flush();
  assert.equal(count, 2);
  assert.equal(e.dirty, false);
  assert.equal(e.error, false);
  e.dispose();
});
test('flush before debounce persists latest draft and no-change flush does not write', async () => {
  const calls = [];
  const e = await editor(async (r) => {
    calls.push(r);
    return { id: 'p', biographyRevision: 1 };
  });
  await e.flush();
  assert.equal(calls.length, 0);
  e.update({ mainBio: 'last keystroke' });
  await e.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.mainBio, 'last keystroke');
  e.dispose();
});
test('late suggestions never overwrite manual input or a disposed profile', async () => {
  const e = await editor(async () => ({ id: 'p', biographyRevision: 1 }));
  const response = deferred();
  const pending = e.suggest('employer', () => response.promise);
  e.update({ position: 'Manual role' });
  response.resolve({ employer: 'Other company', position: 'Other role' });
  await pending;
  assert.equal(e.values.position, 'Manual role');
  assert.equal(e.values.employer, 'Company');
  const next = deferred();
  const late = e.suggest('mainBio', () => next.promise);
  e.dispose();
  next.resolve({ mainBio: 'late' });
  await late;
  assert.equal(e.values.mainBio, 'before');
});
test('transition freeze blocks new edits and suggestions, but flush waits for an already requested suggestion before saving', async () => {
  const calls = [];
  const e = await editor(async (r) => {
    calls.push(r);
    return { id: 'p', biographyRevision: calls.length, biography: r.values };
  });
  const response = deferred();
  const suggesting = e.suggest('mainBio', () => response.promise);
  e.freeze();
  e.update({ mainBio: 'must not enter frozen draft' });
  assert.equal(e.values.mainBio, 'before');
  assert.equal(
    await e.suggest('mainBio', () => {
      throw Error('must not request');
    }),
    false
  );
  let flushed = false;
  const saving = e.flush().then(() => {
    flushed = true;
  });
  await Promise.resolve();
  assert.equal(flushed, false);
  response.resolve({ mainBio: 'requested before transition' });
  await suggesting;
  await saving;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values.mainBio, 'requested before transition');
  e.release();
  e.update({ mainBio: 'editable after failed transition' });
  await e.flush();
  assert.equal(calls.length, 2);
  e.dispose();
});
