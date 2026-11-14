const { normalizeTarget } = require('./normalize.cjs');
const { STATUSES } = require('./diagnostics.cjs');
const PARSER_VERSION = 'public-evidence-v4';
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((match) => [
      match[1].toLowerCase(),
      (match[2] ?? match[3] ?? match[4]).replaceAll('&amp;', '&')
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
// Strip explicitly hidden descendants before treating wording as page evidence.
// This is conservative static inspection, not execution of third-party CSS/JS.
function visibleMarkup(html) {
  const stack = [],
    output = [];
  const voidTags = new Set(
    'area base br col embed hr img input link meta param source track wbr'.split(' ')
  );
  for (const match of html.matchAll(/<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g)) {
    const token = match[0],
      close = /^<\s*\/([a-z][\w:-]*)/i.exec(token);
    if (close) {
      const index = stack.map((item) => item.tag).lastIndexOf(close[1].toLowerCase());
      if (index < 0) continue;
      const hidden = stack.at(-1)?.hidden;
      stack.length = index;
      if (!hidden) output.push(token);
      continue;
    }
    const open = /^<\s*([a-z][\w:-]*)/i.exec(token);
    if (open) {
      const attrs = attributes(token),
        tag = open[1].toLowerCase();
      const style = (attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '');
      const hidden = Boolean(
        stack.at(-1)?.hidden ||
        /\s(?:hidden|inert)(?=\s|=|\/?>)/i.test(token) ||
        attrs['aria-hidden']?.toLowerCase() === 'true' ||
        /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\.0*)?|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(
          style
        )
      );
      if (!hidden) output.push(token);
      if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push({ tag, hidden });
      if (stack.length > 256) return '';
    } else if (!stack.at(-1)?.hidden) output.push(token);
  }
  return output.join('');
}
function inspectResponse(target, { status, body = '', url = target.canonicalUrl }) {
  body = typeof body === 'string' ? body.replace(/<!--[\s\S]*?-->/g, '') : '';
  const complete = !/<html\b/i.test(body) || /<\/html\s*>/i.test(body);
  const markup = visibleMarkup(
    body.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  );
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
  if (status === 429 || /temporarily blocked|too many requests/i.test(text(markup))) {
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
    let person = false,
      contradictoryIdentity = false;
    const contradictoryCanonical = links.some(
      (a) => a.rel?.toLowerCase() === 'canonical' && !sameTarget(a.href, target)
    );
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
        contradictoryIdentity ||= list.some(
          (item) =>
            item?.['@type'] === 'Person' &&
            ((typeof item.url === 'string' && !sameTarget(item.url, target)) ||
              (/^\d+$/.test(target.target) &&
                item.identifier != null &&
                String(item.identifier) !== target.target))
        );
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
    if (
      status === 200 &&
      canonical &&
      profile &&
      person &&
      !contradictoryCanonical &&
      !contradictoryIdentity &&
      sameTarget(url, target)
    ) {
      availability = 'profile_visible';
      reasonCode = 'MATCHED_CANONICAL_AND_PERSON';
    } else if (
      unavailableMessage &&
      sameTarget(url, target) &&
      !contradictoryCanonical &&
      !contradictoryIdentity
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
