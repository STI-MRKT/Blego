const { normalizeTarget } = require('./normalize.cjs');
const PARSER_VERSION = 'public-evidence-v1';
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
  let availability = 'unknown',
    reasonCode = 'INSUFFICIENT_EVIDENCE';
  if (status === 429 || /temporarily blocked|too many requests/i.test(body)) {
    availability = 'request_limited';
    reasonCode = 'REQUEST_LIMITED';
  } else if (
    /\/checkpoint(?:\/|\?)|captcha/i.test(url) ||
    /<form\b[^>]*action=["'][^"']*\/checkpoint\//i.test(body) ||
    /id=["']captcha/i.test(body)
  ) {
    availability = 'challenge_required';
    reasonCode = 'CHECKER_CHALLENGE';
  } else if (
    status === 401 ||
    /\/login(?:\/|\?)/i.test(url) ||
    /id=["']login_form["']/i.test(body)
  ) {
    availability = 'login_required';
    reasonCode = 'LOGIN_REQUIRED';
  } else if (status === 403 || status === 404 || status === 410) {
    availability = 'unavailable';
    reasonCode = `HTTP_${status}`;
  } else if (/content isn['’]t available|page isn['’]t available|page not found/i.test(body)) {
    availability = 'unavailable';
    reasonCode = 'PAGE_UNAVAILABLE_MESSAGE';
  } else if (status >= 200 && status < 300) {
    const links = [...body.matchAll(/<link\b[^>]*>/gi)].map((m) => attributes(m[0]));
    const meta = [...body.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
    const canonical = links.some(
      (a) => a.rel?.toLowerCase() === 'canonical' && sameTarget(a.href, target)
    );
    const profile = meta.some((a) => a.property === 'og:type' && a.content === 'profile');
    let person = false;
    for (const match of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (attributes(match[1]).type !== 'application/ld+json') continue;
      try {
        const data = JSON.parse(match[2]);
        const list = Array.isArray(data) ? data : [data];
        person ||= list.some(
          (item) =>
            item?.['@type'] === 'Person' &&
            sameTarget(item.url, target) &&
            (target.kind !== 'id' || String(item.identifier) === target.target)
        );
      } catch {
        /* Unknown structured data is not evidence. */
      }
    }
    if (canonical && profile && person && sameTarget(url, target)) {
      availability = 'profile_visible';
      reasonCode = 'MATCHED_CANONICAL_AND_PERSON';
    }
  }
  return {
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
