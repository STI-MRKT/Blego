const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectResponse } = require('../../electron/features/facebook/inspect.cjs');
const { normalizeTarget } = require('../../electron/features/facebook/normalize.cjs');
const target = normalizeTarget('synthetic.public.page');
const meta = `<link rel="canonical" href="${target.canonicalUrl}"><meta property="og:url" content="${target.canonicalUrl}"><meta property="og:title" content="Synthetic &amp; Public"><meta property="og:description" content="A public science organization sharing space research and community events."><meta property="og:type" content="video.other">`;
const page = (
  content = '<h1>Synthetic &amp; Public</h1><p>A public science organization sharing space research and community events.</p>'
) => `<html><head>${meta}</head><body>${content}</body></html>`;
test('TZ11 public Page with matching identity and substantive visible content needs no Person JSON-LD', () => {
  const r = inspectResponse(target, { status: 200, body: page() });
  assert.equal(r.availability, 'profile_visible');
  assert.equal(r.profileName, 'Synthetic & Public');
  assert.equal(r.reasonCode, 'MATCHED_PUBLIC_PAGE_CONTENT');
  assert.equal(r.objectType, 'PublicPage');
  assert.equal(r.banAssessment, 'unknown');
});
test('TZ11 metadata-only shells, wrong identity, hidden content and login never become ACTIVE', () => {
  const shell = inspectResponse(target, {
    status: 200,
    body: page('<div id="root"></div><script>/* application boot */</script>')
  });
  assert.equal(shell.availability, 'unknown');
  assert.equal(shell.reasonCode, 'PUBLIC_PREVIEW_ONLY');
  for (const body of [
    page(
      '<div hidden><h1>Synthetic &amp; Public</h1><p>A public science organization sharing space research and community events.</p></div>'
    ),
    page().replaceAll(target.canonicalUrl, 'https://www.facebook.com/other.page'),
    page().replace(
      '</head>',
      '<meta property="og:url" content="https://www.facebook.com/other.page"></head>'
    )
  ])
    assert.equal(inspectResponse(target, { status: 200, body }).availability, 'unknown');
  assert.equal(
    inspectResponse(target, {
      status: 200,
      body: page('<form action="/login/"><input name="email"></form>')
    }).availability,
    'login_required'
  );
  assert.equal(
    inspectResponse(target, { status: 200, body: page('<form action="/checkpoint/"></form>') })
      .availability,
    'challenge_required'
  );
});
test('TZ11 localized unavailable headings use actual target evidence; script placeholders stay unknown', () => {
  for (const title of [
    'Этот контент сейчас недоступен',
    'Esta página no está disponible',
    'Ce contenu n’est pas disponible',
    'Este conteúdo não está disponível'
  ]) {
    assert.equal(
      inspectResponse(target, { status: 200, body: `<html><body><h1>${title}</h1></body></html>` })
        .availability,
      'unavailable'
    );
    assert.equal(
      inspectResponse(target, {
        status: 200,
        body: `<html><body><script>"${title}"</script></body></html>`
      }).availability,
      'unknown'
    );
  }
});
test('TZ11 Checker shows requested and normalized target plus concrete reason without verbose header', async () => {
  const { state } = await import('../../src/js/state.js');
  const { checkerHTML } = await import('../../src/js/ui/checker.js');
  state.checker = {
    input: 'synthetic.public.page',
    rows: [
      {
        id: 'synthetic.public.page',
        input: 'synthetic.public.page',
        link: target.canonicalUrl,
        check: inspectResponse(target, { status: 200, body: page('<div id="root"></div>') })
      }
    ]
  };
  const html = checkerHTML();
  assert.ok(html.includes('Проверка доступности Facebook-профилей'));
  assert.ok(html.includes('Исходный ввод:'));
  assert.ok(html.includes('Нормализованный URL:'));
  assert.ok(html.includes('только предварительные сведения'));
});

test('TZ11 normalized checker rows retain original input separately from canonical URL', async () => {
  globalThis.window = {
    blego: {
      normalizeFacebook: async () => ({
        inputRows: [
          {
            raw: 'https://m.facebook.com/Synthetic.Public.Page/',
            target: 'synthetic.public.page',
            kind: 'username',
            canonicalUrl: target.canonicalUrl
          }
        ],
        manualNotes: {}
      })
    }
  };
  try {
    const { parseIds } = await import('../../src/js/services/checker.js');
    const [row] = await parseIds('input');
    assert.equal(row.input, 'https://m.facebook.com/Synthetic.Public.Page/');
    assert.equal(row.link, target.canonicalUrl);
  } finally {
    delete globalThis.window;
  }
});
test('Chromium DNS, TLS, connection and timeout errors retain specific diagnostics', () => {
  const { networkReason } = require('../../electron/features/facebook/diagnostics.cjs');
  for (const [code, reason] of [
    ['ERR_NAME_NOT_RESOLVED', 'FB_DNS_ERROR'],
    ['ERR_CERT_AUTHORITY_INVALID', 'FB_TLS_ERROR'],
    ['ERR_CONNECTION_REFUSED', 'FB_CONNECTION_REFUSED'],
    ['ERR_CONNECTION_RESET', 'FB_CONNECTION_RESET'],
    ['ERR_CONNECTION_TIMED_OUT', 'FB_TIMEOUT'],
    ['ERR_INTERNET_DISCONNECTED', 'FB_NETWORK_UNREACHABLE']
  ])
    assert.equal(networkReason(Error('net::' + code)), reason);
});
