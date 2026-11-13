const { randomUUID } = require('node:crypto');
// Shutdown is a two-phase operation: renderer flushes its latest draft, then the
// main process closes the window/store. IPC sender validation stays in registerIpc.
function createBiographyCloseGate({ send, close, quit }) {
  let ready = false,
    allowed = false,
    pending = null,
    quitting = false;
  function request(event) {
    if (!ready || allowed) return;
    event.preventDefault();
    if (!pending) {
      pending = randomUUID();
      send(pending);
    }
  }
  return {
    ready() {
      ready = true;
    },
    onClose: request,
    beforeQuit(event) {
      quitting = true;
      request(event);
    },
    acknowledge(result) {
      if (!pending || result?.token !== pending || typeof result.saved !== 'boolean') return false;
      pending = null;
      if (!result.saved) {
        quitting = false;
        return false;
      }
      allowed = true;
      if (quitting) quit();
      else close();
      return true;
    }
  };
}
module.exports = { createBiographyCloseGate };
