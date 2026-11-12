function validateSender(event, webContents, url) {
  return Boolean(
    webContents &&
    event.sender === webContents &&
    event.senderFrame === webContents.mainFrame &&
    event.senderFrame?.origin === new URL(url).origin &&
    event.senderFrame?.url === url
  );
}
function externalUrl(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 8192) return null;
    const u = new URL(raw);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
async function copyText(text, clipboard) {
  if (typeof text !== 'string') return { ok: false, code: 'INVALID_TEXT' };
  if (Buffer.byteLength(text, 'utf8') > 10 * 1024 * 1024)
    return { ok: false, code: 'COPY_TOO_LARGE' };
  try {
    await clipboard.writeText(text);
    if ((await clipboard.readText()) !== text) throw Error();
    return { ok: true };
  } catch {
    return { ok: false, code: 'CLIPBOARD_FAILED' };
  }
}
async function copyImage(image, clipboard, api) {
  try {
    api ||= require('electron');
    if (image.isEmpty()) throw Error('EMPTY_IMAGE');
    const before = image.toBitmap(),
      size = image.getSize();
    await clipboard.write([
      new api.ClipboardItem({ 'image/png': new Blob([image.toPNG()], { type: 'image/png' }) })
    ]);
    const items = await clipboard.read();
    const entry = items.find((item) => item.types.includes('image/png'));
    if (!entry) throw Error('CLIPBOARD_MISMATCH');
    const blob = await entry.getType('image/png');
    const actual = api.nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
    if (
      actual.isEmpty() ||
      actual.getSize().width !== size.width ||
      actual.getSize().height !== size.height ||
      !actual.toBitmap().equals(before)
    )
      throw Error('CLIPBOARD_MISMATCH');
    return { ok: true };
  } catch {
    return { ok: false, code: 'CLIPBOARD_FAILED' };
  }
}
function registerIpc(ipcMain, getWindow, getUrl, handlers) {
  for (const [name, handler] of Object.entries(handlers))
    ipcMain.handle(`local:${name}`, async (event, arg) => {
      if (!validateSender(event, getWindow()?.webContents, getUrl())) throw Error('UNTRUSTED_IPC');
      try {
        return { ok: true, value: await handler(arg) };
      } catch (e) {
        return {
          ok: false,
          code: /^[A-Z][A-Z_]+$/.test(e.code || e.message)
            ? e.code || e.message
            : 'OPERATION_FAILED',
          details: e.code === 'POOL_EXHAUSTED' ? e.details : undefined
        };
      }
    });
}
module.exports = { validateSender, externalUrl, copyText, copyImage, registerIpc };
