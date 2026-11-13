const { Worker } = require('node:worker_threads');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const bundled = require('../../../resources/geo/cities.json');
const { publicCity } = require('./catalog.cjs');
function createGeoService({ store } = {}) {
  let imported = store?.get('geo:catalog') || [];
  if (!Array.isArray(imported) || imported.length > 100) throw Error('GEO_INVALID_CATALOG');
  const jobs = new Map(),
    previews = new Map();
  const all = () => [...bundled.cities, ...imported];
  function cancel(id) {
    const job = jobs.get(id);
    if (!job) return false;
    job.reject(Error('CANCELLED'));
    job.worker.terminate();
    jobs.delete(id);
    return true;
  }
  async function run(data, id = randomUUID()) {
    if (typeof id !== 'string' || !id.length || id.length > 120) throw Error('GEO_INVALID_REQUEST');
    if (jobs.has(id) || jobs.size >= 2) throw Error('GEO_BUSY');
    const worker = new Worker(path.join(__dirname, 'worker.cjs'), {
      workerData: data,
      resourceLimits: { maxOldGenerationSizeMb: 128 }
    });
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        jobs.set(id, { worker, reject });
        timer = setTimeout(() => {
          reject(Error('GEO_OPERATION_TIMEOUT'));
          worker.terminate();
        }, 10000);
        worker.once('message', (r) => (r.ok ? resolve(r.value) : reject(Error(r.code))));
        worker.once('error', () => reject(Error('GEO_OPERATION_FAILED')));
        worker.once('exit', (code) => {
          if (code) reject(Error('GEO_OPERATION_FAILED'));
        });
      });
    } finally {
      clearTimeout(timer);
      jobs.delete(id);
      worker.terminate();
    }
  }
  return {
    catalog({ country = '', query = '' } = {}) {
      if (typeof country !== 'string' || typeof query !== 'string' || query.length > 120)
        throw Error('GEO_INVALID_REQUEST');
      const rows = all(),
        q = query.toLocaleLowerCase();
      const display = new Intl.DisplayNames(['ru'], { type: 'region' });
      return {
        countries: [...new Set(rows.map((c) => c.country))]
          .sort()
          .map((code) => ({ code, name: display.of(code) })),
        cities: rows
          .filter(
            (c) =>
              (!country || c.country === country) &&
              (!q || `${c.name} ${c.region}`.toLocaleLowerCase().includes(q))
          )
          .map(publicCity)
      };
    },
    async boundary({ cityId, requestId } = {}) {
      const city = all().find((c) => c.id === cityId);
      if (!city) throw Error('GEO_BOUNDARY_UNAVAILABLE');
      const geometry = await run({ kind: 'boundary', geometry: city.geometry }, requestId);
      return { city: publicCity(city), geometry };
    },
    async validatePoint({ cityId, point, exclude = [], requestId } = {}) {
      const city = all().find((c) => c.id === cityId);
      if (!city) throw Error('GEO_BOUNDARY_UNAVAILABLE');
      if (
        !Array.isArray(exclude) ||
        exclude.length > 1000 ||
        exclude.some((p) => !p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))
      )
        throw Error('GEO_INVALID_REQUEST');
      const value = await run(
        { kind: 'point', geometry: city.geometry, point, exclude },
        requestId
      );
      return { city: publicCity(city), point: value };
    },
    async generate({ cityId, count, exclude = [], requestId } = {}) {
      const city = all().find((c) => c.id === cityId);
      if (!city) throw Error('GEO_BOUNDARY_UNAVAILABLE');
      if (
        !Array.isArray(exclude) ||
        exclude.length > 10000 ||
        exclude.some((p) => !p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))
      )
        throw Error('GEO_INVALID_REQUEST');
      const points = await run(
        { kind: 'generate', geometry: city.geometry, count, exclude },
        requestId
      );
      return { city: publicCity(city), points, generated: true };
    },
    async previewImport(bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.length > 8 * 1024 * 1024)
        throw Error('GEO_INPUT_TOO_LARGE');
      const cities = await run({ kind: 'package', bytes });
      const existing = new Set(all().map((c) => c.id));
      const added = cities.filter((c) => !existing.has(c.id));
      if (
        imported.length + added.length > 100 ||
        Buffer.byteLength(JSON.stringify([...imported, ...added])) > 16 * 1024 * 1024
      )
        throw Error('GEO_CACHE_FULL');
      previews.clear();
      const token = randomUUID();
      previews.set(token, added);
      return {
        token,
        added: added.length,
        duplicates: cities.length - added.length,
        cities: added.map(publicCity)
      };
    },
    confirmImport(token) {
      if (!previews.has(token)) throw Error('GEO_INVALID_PREVIEW');
      const next = [...imported, ...previews.get(token)].map((c) => ({ ...c, userSupplied: true }));
      if (store) store.transaction(() => store.set('geo:catalog', next));
      imported = next;
      previews.clear();
      return { saved: true, count: next.length };
    },
    cancel,
    close() {
      for (const id of jobs.keys()) cancel(id);
      previews.clear();
    }
  };
}
module.exports = { createGeoService };
