// Shared cancellation utility used by Network/Proxy; independent of Facebook Checker.
function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || Error('CANCELLED'));
    if (signal.aborted) {
      Promise.resolve(promise).catch(() => {});
      return abort();
    }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
module.exports = { withAbort };
