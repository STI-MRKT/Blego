// Explicit operator-run public observation only. Never runs at app startup.
const fs = require('node:fs'),
  { createHash } = require('node:crypto');
const { createFacebookService } = require('../electron/features/facebook/service.cjs');
const { fetchPublicProfile } = require('../electron/features/facebook/transport.cjs');
(async () => {
  const output = process.argv[2];
  if (!output) throw Error('Pass report path');
  const targets = ['https://www.facebook.com/facebook', 'https://www.facebook.com/Meta'];
  const observed = new Map();
  const service = createFacebookService({
    transport: async (url, options) => {
      const r = await fetchPublicProfile(url, options);
      observed.set(url, {
        httpStatus: r.status,
        bodyBytes: Buffer.byteLength(r.body || ''),
        bodySha256: createHash('sha256')
          .update(r.body || '')
          .digest('hex')
      });
      return r;
    }
  });
  const results = [];
  for await (const r of service.check({
    targets: targets.map((canonicalUrl) => ({ canonicalUrl })),
    runId: 'unified-12-live'
  }))
    results.push({
      label: 'public-organization-' + (results.length + 1),
      checkedAt: r.checkedAt,
      availability: r.availability,
      reasonCode: r.reasonCode,
      banAssessment: r.banAssessment,
      parserVersion: r.parserVersion,
      durationMs: r.durationMs,
      ...observed.get(r.canonicalUrl)
    });
  const report = {
    os: process.platform,
    arch: process.arch,
    conditions:
      'Codex Cloud; official public organization pages; no login, cookies, proxy bypass or challenge solving; existing bounded client and sequential rate-limited queue; body not persisted',
    results,
    coverage:
      'Only these observed responses; not a representative profile corpus or a ban classifier.'
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
