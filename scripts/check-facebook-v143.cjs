// Explicit QA action only. Anonymous public targets; no user secrets or HTML persisted.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { fetchPublicProfile } = require('../electron/features/facebook/transport.cjs');
const { createFacebookService } = require('../electron/features/facebook/service.cjs');
const { normalizeTarget } = require('../electron/features/facebook/normalize.cjs');
const { facebookPresentation } = require('../shared/facebook-presentation.mjs');
(async () => {
  const file = process.argv[2];
  if (!file) throw Error('REPORT_PATH_REQUIRED');
  const proofs = new Map();
  const service = createFacebookService({
    transport: async (url, options) => {
      const r = await fetchPublicProfile(url, options);
      proofs.set(url, {
        httpStatus: r.status,
        finalUrl: r.url,
        bodyBytes: Buffer.byteLength(r.body),
        bodySha256: createHash('sha256').update(r.body).digest('hex'),
        transport: r.diagnostics,
        headings: (r.body.match(/<h1\b/gi) || []).length,
        structuredScripts: (r.body.match(/type=["']application\/ld\+json/gi) || []).length,
        method: 'anonymous HTTPS; TLS verified; bounded redirects/decoded response; no credentials'
      });
      return r;
    }
  });
  const rows = [];
  for (const target of [
    'https://www.facebook.com/NASA',
    'https://www.facebook.com/meta',
    'https://www.facebook.com/zuck'
  ]) {
    for await (const result of service.check({
      targets: [normalizeTarget(target)],
      runId: 'tz11-live-' + rows.length
    })) {
      const presentation = facebookPresentation(result);
      rows.push({
        target,
        result,
        display: presentation,
        proof: proofs.get(normalizeTarget(target).canonicalUrl) || null,
        acceptance: presentation.status === 'ACTIVE' ? 'PASS' : 'BLOCKED'
      });
    }
  }
  const report = {
    at: new Date().toISOString(),
    host: process.platform + '-' + process.arch,
    targets: rows,
    positivePublicAcceptance: rows.some((r) => r.display.status === 'ACTIVE') ? 'PASS' : 'BLOCKED',
    confirmedUnavailableTarget: {
      status: 'BLOCKED',
      reason:
        'No independently confirmed unavailable public target supplied; not inferred from random IDs or HTTP status'
    },
    scope:
      'Live anonymous transport/inspector. Controlled HTML tests are separate and cannot substitute for live positive acceptance.'
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      positivePublicAcceptance: report.positivePublicAcceptance,
      targets: rows.map((r) => ({
        target: r.target,
        status: r.display.status,
        reason: r.result.reasonCode
      }))
    })
  );
})().catch((e) => {
  console.error(e.code || 'FACEBOOK_QA_FAILED');
  process.exitCode = 1;
});
