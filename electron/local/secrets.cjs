// Main-process only. No API exposes secret values to the renderer.
function secretVault(store, safeStorage) {
  const available = () =>
    safeStorage.isEncryptionAvailable() &&
    safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  return {
    set(name, value) {
      if (!/^[a-z0-9_-]{1,80}$/i.test(name) || typeof value !== 'string' || value.length > 8192)
        throw Error('INVALID_SECRET');
      if (!available()) throw Error('SECURE_STORAGE_UNAVAILABLE');
      store.set(`secret:${name}`, safeStorage.encryptString(value).toString('base64'));
    },
    get(name) {
      const value = store.get(`secret:${name}`);
      if (!value) return null;
      if (!available()) throw Error('SECURE_STORAGE_UNAVAILABLE');
      return safeStorage.decryptString(Buffer.from(value, 'base64'));
    }
  };
}
module.exports = { secretVault };
