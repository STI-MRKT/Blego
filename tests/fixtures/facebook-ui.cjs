// Deterministic third-party provider fixture for GUI tests; never calls check.fb.tools.
async function installFacebookFixture(app, delay = 10) {
  await app.evaluate(({ ipcMain }, delay) => {
    globalThis.fbCalls = [];
    ipcMain.removeHandler('local:facebookCheck');
    ipcMain.handle('local:facebookCheck', async (_event, request) => {
      globalThis.fbCalls.push(request);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return {
        ok: true,
        value: {
          results: request.targets.map((target) => ({
            ...target,
            status: 'AVAILABLE',
            availability: 'profile_visible',
            source: 'fbtools',
            parserVersion: 'fbtools-ndjson-v1',
            reasonCode: 'FBTOOLS_VALID',
            banAssessment: 'unknown',
            checkedAt: new Date().toISOString(),
            durationMs: delay,
            runId: request.runId
          }))
        }
      };
    });
  }, delay);
}
module.exports = { installFacebookFixture };
