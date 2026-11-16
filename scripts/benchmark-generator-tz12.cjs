// Same-host, isolated SQLite comparison; explicit bulk consent, no real user data.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
async function main() {
  const project = path.resolve(process.argv[2] || '.');
  const output = process.argv[3];
  const load = createRequire(path.join(project, 'package.json'));
  const { openStore } = load('./electron/local/store.cjs');
  const { generateProfile } = load('./electron/features/generator/service.cjs');
  const samples = [];
  for (let sample = 0; sample < 3; sample++) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz12-perf-'));
    const store = await openStore(root);
    const timings = [];
    try {
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await generateProfile(
          {
            country: ['BR', 'US', 'FR', 'PL', 'DE', 'ES', 'IT', 'GB'][i % 8],
            type: ['model', 'tech', 'crypto'][Math.floor(i / 8) % 3],
            requestId: `sample-${i}`
          },
          { store, settings: { bulkMode: true, bulkConsent: true } }
        );
        timings.push(performance.now() - start);
      }
    } finally {
      store.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
    const sorted = [...timings].sort((a, b) => a - b);
    samples.push({
      totalMs: timings.reduce((a, b) => a + b, 0),
      p50Ms: sorted[50],
      p95Ms: sorted[95],
      maxMs: sorted.at(-1)
    });
  }
  const result = {
    project,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    method:
      'Three independent 100-profile SQLite stores, same country/type sequence, explicit bulk consent, production random selection. Includes registry and rules hashing; not a cold-cache scientific benchmark.',
    samples
  };
  const text = JSON.stringify(result, null, 2) + '\n';
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, text);
  } else process.stdout.write(text);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
