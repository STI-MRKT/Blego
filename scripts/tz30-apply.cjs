(function applyTZ30() {
  'use strict';
  const fs = require('node:fs');
  function replaceOne(text, from, to, label) {
    if (!text.includes(from)) throw new Error('TZ30 patch anchor missing: ' + label);
    return text.replace(from, to);
  }
  function edit(path, fn) {
    const before = fs.readFileSync(path, 'utf8');
    const after = fn(before);
    if (before === after) throw new Error('TZ30 did not modify ' + path);
    fs.writeFileSync(path, after);
    console.log('TZ30 patched: ' + path);
  }
  edit('src/js/main.js', (s) => {
    const original = "let newsRequest = 0;\nfunction ensureNews() {\n  if (state.view !== 'news' || !state.settings.newsEnabled) return;\n  if (!state.news.lastAttemptAt && !state.news.loading) refreshNews(false);\n}\n";
    const revised = [
      'let newsRequest = 0;',
      'const NEWS_FAILURE_RETRY_MS = 3 * 60 * 1000;',
      'function newsIsDue() {',
      '  const sources = Object.values(state.news.sourceStates || {});',
      '  const attempts = sources.map((s) => Date.parse(s.lastAttemptAt)).filter(Number.isFinite);',
      '  const last = attempts.length ? Math.max(...attempts) : Date.parse(state.news.lastAttemptAt);',
      '  if (!Number.isFinite(last)) return true;',
      '  const period = (Number(state.settings.newsInterval) || 30) * 60 * 1000;',
      "  const failed = sources.some((s) => s.stale || (s.status && s.status !== 'ok'));",
      '  return Date.now() - last >= (failed ? Math.min(period, NEWS_FAILURE_RETRY_MS) : period);',
      '}',
      'function ensureNews() {',
      "  if (state.view !== 'news' || !state.settings.newsEnabled || state.news.loading) return;",
      '  if (newsIsDue()) refreshNews(false);',
      '}',
      ''
    ].join('\n');
    s = replaceOne(s, original, revised, 'automatic news refresh');
    s = replaceOne(s, 'renderAll();\nsetTimeout(() => {', [
      'renderAll();',
      "// Poll only while the News view is selected; other sections never fetch in the background.",
      "setInterval(() => { if (state.view === 'news') ensureNews(); }, 60 * 1000);",
      'setTimeout(() => {'
    ].join('\n'), 'news timer');
    return s;
  });
  edit('electron/features/news/service.cjs', (s) => {
    s = replaceOne(s, "          received: c.received || 0\n", "          received: c.received || 0,\n          httpStatus: c.httpStatus || null\n", 'news source httpStatus');
    s = replaceOne(s, [
      '            const age = clock() - new Date(previous.lastAttemptAt || 0);',
      '            if (',
      '              previous.lastAttemptAt &&',
      '              age < (options.force ? minRefreshMs : settings.newsInterval * 60000)',
      '            )',
      '              return;'
    ].join('\n'), [
      '            const age = clock() - new Date(previous.lastAttemptAt || 0);',
      "            const wasUnavailable = previous.stale || ['unavailable', 'rate_limited'].includes(previous.status);",
      '            const interval = options.force',
      '              ? minRefreshMs',
      '              : wasUnavailable',
      '                ? Math.min(settings.newsInterval * 60000, 3 * 60000)',
      '                : settings.newsInterval * 60000;',
      '            if (previous.lastAttemptAt && age < interval) return;'
    ].join('\n'), 'retry on unavailable feed');
    s = replaceOne(s, "                code: /^[A-Z_]+$/.test(e.message) ? e.message : 'FETCH_FAILED'\n", [
      "                code: /^[A-Z_]+$/.test(e.message) ? e.message : 'FETCH_FAILED',",
      '                httpStatus: Number.isInteger(e.httpStatus) ? e.httpStatus : null'
    ].join('\n') + '\n', 'news per-source diagnostics');
    return s;
  });
  edit('electron/features/news/feeds.cjs', (s) => {
    s = replaceOne(s, [
      '      throw Error(',
      '        response.status === 429',
      "          ? 'RATE_LIMITED'",
      '          : response.status === 403',
      "            ? 'ACCESS_DENIED'",
      "            : 'HTTP_ERROR'",
      '      );'
    ].join('\n'), [
      '      const error = Error(',
      '        response.status === 429',
      "          ? 'RATE_LIMITED'",
      '          : response.status === 403',
      "            ? 'ACCESS_DENIED'",
      "            : 'HTTP_ERROR'",
      '      );',
      '      error.httpStatus = response.status;',
      '      throw error;'
    ].join('\n'), 'feed HTTP diagnostics');
    return s;
  });
  edit('shared/news-catalog.mjs', (s) => {
    s = replaceOne(s,
      "new RegExp(pattern, 'i').test(title + ' ' + new URL(link).pathname)",
      "new RegExp(pattern, 'i').test(title + ' ' + (source.topic === 'crypto' ? String(description || '').slice(0, 2000) + ' ' : '') + new URL(link).pathname)",
      'crypto description relevance'
    );
    s = replaceOne(s, "stablecoin|token|defi|web3|solana|binance|coinbase", "stablecoin|token|defi|web3|solana|binance|coinbase|on.chain|staking|wallet|altcoin|memecoin|tokeniz|crypto.exchange|\\\\bXRP\\\\b|\\\\bCBDC\\\\b", 'expanded crypto vocabulary');
    return s;
  });
  console.log('TZ30 News patch complete');
})();
