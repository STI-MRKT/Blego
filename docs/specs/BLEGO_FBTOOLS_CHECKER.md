# BLEGO · Facebook Checker · FB.Tools provider (experimental)

## Scope

This integration uses BLEGO's existing Checker page. No separate Python server,
database, background monitoring or second application is introduced.

The existing direct public-page diagnostic is unchanged. The user can select
check.fb.tools in the "Источник" selector. Links are submitted only when the
user presses Check; switching provider clears the previous results.

## Transport

The provider adapter lives in electron/features/facebook/fbtools.cjs.

- POST https://check.fb.tools/api/check/facebook
- Content-Type: application/json
- Accept: application/x-ndjson
- Body: {"inputData":["https://www.facebook.com/profile.php?id=4"],"userLang":"en","checkFriends":false}

The adapter consumes start, result, summary and error NDJSON events. Results
are tied to normalized inputs by both one-based id and matching origin, not
provider-reported arbitrary links.

The connection does not send cookies, credentials, Authorization, or browser
profile state. No redirects are allowed. No proxy rotation, CAPTCHA handling,
bypass or automatic retry loop. Input cap: 100 profiles. Request timeout:
60 seconds. Maximum response: 2 MiB.

## Provider statuses

| Provider | BLEGO | Meaning |
| --- | --- | --- |
| valid | LIVE | Third party reports public profile available |
| noexist | DIE | Third party reports no public profile found |
| invalid, verify, error, other | UNKNOWN | No conclusive result |
| HTTP errors, 429, timeout, partial or malformed body | UNKNOWN | No conclusive result |

The result does not prove an account ban, deletion, Business Manager or
advertising restriction. The existing direct source remains available.

## Provider stability and release gate

This endpoint was observed in publicly delivered website JavaScript on
2026-11-17. A known-public UID request succeeded within the website's browser
context. It is an undocumented internal endpoint; use from a standalone
Electron application has NOT been independently confirmed.

Use is subject to provider approval and applicable usage restrictions.
Before any signed app release:

1. Run npm ci, npm run lint, npm run test:unit, npm run test:integration,
   and the targeted Checker UI tests.
2. Check positive and negative control UIDs from an installed macOS ARM64
   application. Confirm an HTTP 429 is UNKNOWN, not DIE.
3. Test changing provider, retry, cancellation, bulk copy and existing
   import/notes, without changes to other sections.
4. If the provider refuses access, display UNKNOWN, keep direct source and
   do not bypass restrictions.

Coverage:
- tests/integration/facebook-fbtools.test.cjs
- tests/unit/fbtools-checker-ui.test.cjs
