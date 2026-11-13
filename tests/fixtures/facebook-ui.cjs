// Deterministic anonymous-response fixture for GUI tests; no fake production transport.
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
            availability: 'login_required',
            reasonCode: 'LOGIN_REQUIRED',
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
