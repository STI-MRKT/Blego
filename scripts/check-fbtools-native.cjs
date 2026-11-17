'use strict';

// Real, opt-in provider observation through installed BLEGO.app.
// No mocked IPC and no credentials/cookies. Never runs in unit CI.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');

const CONTROLS = [
  { uid: '4', expected: 'LIVE', purpose: 'known-public-control' },
  { uid: '999999999999999', expected: 'DIE', purpose: 'known-nonexistent-control' }
];

async function main() {
  const executable = process.env.BLEGO_EXECUTABLE;
  const output = path.resolve(process.argv[2] || 'release/fbtools-live-native.json');
  if (!executable || !fs.existsSync(executable)) throw Error('INSTALLED_EXECUTABLE_REQUIRED');
  if (process.platform !== 'darwin') throw Error('MACOS_REQUIRED');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-fbtools-native-'));
  const data = path.join(temp, 'user-data');
  fs.mkdirSync(data);
  fs.writeFileSync(path.join(data, 'blego-state.json'), '{"tourSeen":true}');

  const report = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    executable,
    service: 'check.fb.tools',
    provider: 'fbtools',
    kind: 'installed-application-live-unmocked',
    controls: CONTROLS,
    outcome: 'NOT_RUN',
    results: [],
    copy: { outcome: 'NOT_RUN' },
    notes:
      'Checks classify publicly visible profiles according to an undocumented third-party API, not account bans, ad restrictions, or Meta official state.'
  };

  let app;
  try {
    app = await _electron.launch({
      executablePath: executable,
      args: ['--user-data-dir=' + data],
      timeout: 90000
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="checker"]').click({ timeout: 30000 });
    if (await page.locator('#checker-provider').count())
      throw Error('LEGACY_PROVIDER_SELECTOR_PRESENT');

    await page.locator('#checker-input').fill(CONTROLS.map((item) => item.uid).join('\n'));
    await page.locator('[data-action="checker-run"]').click();

    // The production IPC path and provider adapter run without test overrides.
    await page.waitForFunction(
      async (count) => {
        const { state } = await import('/js/state.js');
        return (
          !state.checker.checking &&
          state.checker.rows?.length === count &&
          state.checker.rows.every((row) => row.check)
        );
      },
      CONTROLS.length,
      { timeout: 90000 }
    );

    report.results = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      const { facebookPresentation } = await import('/shared/facebook-presentation.mjs');
      return state.checker.rows.map((row) => ({
        uid: row.id,
        status: facebookPresentation(row.check).status,
        source: row.check?.source,
        reasonCode: row.check?.reasonCode,
        httpStatus: row.check?.httpStatus ?? null,
        checkedAt: row.check?.checkedAt,
        providerError:
          row.check?.reasonCode?.startsWith('FBTOOLS_') &&
          !['FBTOOLS_VALID', 'FBTOOLS_NOEXIST'].includes(row.check.reasonCode)
      }));
    });

    const visibleStatuses = await page
      .locator('[data-checker-status]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.checkerStatus));
    report.visibleStatuses = visibleStatuses;

    await page.locator('[data-action="checker-copy-results"]').click();
    const expectedText = report.results.map((row) => row.uid + '\t' + row.status).join('\n');
    let actualText = '';
    for (let attempt = 0; attempt < 30; attempt += 1) {
      actualText = await app.evaluate(({ clipboard }) => clipboard.readText());
      if (actualText === expectedText) break;
      await page.waitForTimeout(100);
    }
    report.copy = {
      outcome: actualText === expectedText ? 'PASS' : 'FAIL',
      actual: actualText,
      expected: expectedText
    };

    const screenshot = path.join(path.dirname(output), 'fbtools-live-native.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    report.screenshot = screenshot;

    const statusesMatch = CONTROLS.every(
      (item, index) =>
        report.results[index]?.uid === item.uid &&
        report.results[index]?.source === 'fbtools' &&
        report.results[index]?.status === item.expected &&
        visibleStatuses[index] === item.expected
    );
    report.outcome = statusesMatch && report.copy.outcome === 'PASS' ? 'PASS' : 'FAIL';
  } catch (error) {
    report.outcome = 'FAIL';
    report.failure = error?.code || error?.message || 'UNKNOWN_FAILURE';
  } finally {
    try {
      if (app) await app.close();
    } catch {
      report.closeError = 'APP_CLOSE_FAILED';
    }
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    fs.rmSync(temp, { recursive: true, force: true });
  }
  if (report.outcome !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.code || error?.message || 'LIVE_TEST_FAILED');
  process.exitCode = 1;
});
