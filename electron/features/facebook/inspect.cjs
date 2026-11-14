const { normalizeTarget } = require('./normalize.cjs');
const { STATUSES } = require('./diagnostics.cjs');
const PARSER_VERSION = 'public-evidence-v4';
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1].toLowerCase(),
      (match[2] ?? match[3]).replaceAll('&amp;', '&')
    ])
  );
}
function sameTarget(raw, target) {
  try {
    return normalizeTarget(raw).canonicalUrl === target.canonicalUrl;
  } catch {
    return false;
  }
}
function inspectResponse(target, { status, body = '', url = target.canonicalUrl }) {
  body = typeof body === 'string' ? body.replace(/<!--[\s\S]*?-->/g, '') : '';
  const complete = !/<html\b/i.test(body) || /<\/html\s*>/i.test(body);
  const markup = body.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const text = (html) =>
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(?:#0?39|apos);/gi, "'")
      .replace(/&(?:#8217|rsquo);/gi, '’')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const unavailable =
    /^(?:(?:this )?content isn['’]t available(?: right now)?|(?:this )?page isn['’]t available|page not found)[.!]?$/i;
  const unavailableMessage =
    unavailable.test(text(markup)) ||
    [...markup.matchAll(/<(h1|h2|title)\b[^>]*>([\s\S]*?)<\/\1>/gi)].some((match) =>
      unavailable.test(text(match[2]))
    );
  let facts = null;
  let availability = 'unknown',
    reasonCode = 'INSUFFICIENT_EVIDENCE';
  if (status === 429 || /temporarily blocked|too many requests/i.test(body)) {
    availability = 'request_limited';
    reasonCode = 'REQUEST_LIMITED';
  } else if (
    /\/checkpoint(?:\/|\?|$)|captcha/i.test(url) ||
    /<form\b[^>]*action=["'][^"']*\/checkpoint\//i.test(body) ||
    /id=["']captcha/i.test(body)
  ) {
    availability = 'challenge_required';
    reasonCode = 'CHECKER_CHALLENGE';
  } else if (
    status === 401 ||
    /\/login(?:\.php)?(?:\/|\?|$)/i.test(url) ||
    /id=["']login_form["']/i.test(body) ||
    /<form\b[^>]*action=["'][^"']*\/login(?:\.php)?(?:[/?"'])/i.test(body)
  ) {
    availability = 'login_required';
    reasonCode = 'LOGIN_REQUIRED';
  } else if ([200, 404, 410].includes(status) && complete) {
    const links = [...markup.matchAll(/<link\b[^>]*>/gi)].map((m) => attributes(m[0]));
    const meta = [...markup.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
    const canonical = links.some(
      (a) => a.rel?.toLowerCase() === 'canonical' && sameTarget(a.href, target)
    );
    const profile = meta.some((a) => a.property === 'og:type' && a.content === 'profile');
    let person = false;
    for (const match of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (attributes(match[1]).type !== 'application/ld+json') continue;
      try {
        const data = JSON.parse(match[2], (_key, value, context) =>
          typeof value === 'number' && !Number.isSafeInteger(value) ? context?.source : value
        );
        const list = Array.isArray(data) ? data : [data];
        // JSON-LD commonly groups top-level entities under @graph. Bound traversal
        // and do not follow remote contexts or links.
        for (let i = 0; i < list.length && i < 1000; i++) {
          const graph = list[i]?.['@graph'];
          if (Array.isArray(graph)) list.push(...graph.slice(0, 1000 - list.length));
        }
        const personMatch = list.find(
          (item) =>
            item?.['@type'] === 'Person' &&
            typeof item.name === 'string' &&
            item.name.trim().length > 0 &&
            item.name.length <= 300 &&
            !/[\u0000-\u001f]/.test(item.name) &&
            sameTarget(item.url, target) &&
            (!/^\d+$/.test(target.target) || String(item.identifier) === target.target)
        );
        if (personMatch) {
          person = true;
          facts = personMatch;
        }
      } catch {
        /* Unknown structured data is not evidence. */
      }
    }
    if (status === 200 && canonical && profile && person && sameTarget(url, target)) {
      availability = 'profile_visible';
      reasonCode = 'MATCHED_CANONICAL_AND_PERSON';
    } else if (
      unavailableMessage &&
      sameTarget(url, target) &&
      !links.some((a) => a.rel?.toLowerCase() === 'canonical' && !sameTarget(a.href, target))
    ) {
      availability = 'unavailable';
      reasonCode = 'PAGE_UNAVAILABLE_MESSAGE';
    }
    if (availability === 'unknown' && status !== 200) reasonCode = `HTTP_${status}`;
  }
  if (!complete && availability === 'unknown') reasonCode = 'INCOMPLETE_RESPONSE';
  else if (availability === 'unknown' && status === 403) reasonCode = 'HTTP_403';
  else if (availability === 'unknown' && status >= 500) reasonCode = 'FB_HTTP_ERROR';
  const visible = availability === 'profile_visible';
  const profileName =
    visible &&
    typeof facts?.name === 'string' &&
    facts.name.length <= 300 &&
    !/[\u0000-\u001f]/.test(facts.name)
      ? facts.name
      : null;
  const candidate = typeof facts?.image === 'string' ? facts.image : facts?.image?.url;
  let avatarUrl = null;
  if (visible && typeof candidate === 'string' && candidate.length <= 2048) {
    try {
      const u = new URL(candidate);
      if (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.port &&
        (u.hostname === 'fbcdn.net' || u.hostname.endsWith('.fbcdn.net'))
      )
        avatarUrl = u.href;
    } catch {
      /* Unknown image references remain empty. */
    }
  }
  return {
    status: STATUSES[availability],
    publicContent: visible ? 'available' : availability === 'unavailable' ? 'unavailable' : null,
    source: 'public_page',
    profileName,
    avatarUrl,
    objectType: visible ? 'Person' : null,
    target: target.target,
    canonicalUrl: target.canonicalUrl,
    availability,
    reasonCode,
    httpStatus: status,
    banAssessment: 'unknown',
    evidenceSummary: reasonCode,
    parserVersion: PARSER_VERSION
  };
}
module.exports = { inspectResponse, PARSER_VERSION };
