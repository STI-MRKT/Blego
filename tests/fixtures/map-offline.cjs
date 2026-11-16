// Explicit test fixture: unrelated GUI scenarios must not repeatedly download public OSM tiles.
// Map recovery/auto-load suites use their own controlled raster provider; live QA remains separate.
async function firstWindowOfflineMap(app) {
  const page = await app.firstWindow();
  await app.evaluate(({ ipcMain }) => {
    const channel = 'local:mapTile';
    const original = ipcMain._invokeHandlers.get(channel);
    if (!original || globalThis.offlineMapOriginal) return;
    globalThis.offlineMapOriginal = original;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, () => ({ ok: false, code: 'MAP_UNAVAILABLE' }));
  });
  return page;
}
module.exports = { firstWindowOfflineMap };
