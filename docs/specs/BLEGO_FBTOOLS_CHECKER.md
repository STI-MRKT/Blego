# BLEGO 1.4.4 — Facebook UID Checker: FB.Tools only

Decision (2026-11-17): the direct Facebook public-HTML checker was found
unreliable and is **retired**. It was preserved in the Git branch:

archive/blego-facebook-direct-legacy-20261117
(legacy revision 746a7ee6b452d9275f020b791b13fc52d541dbd7).

Do not silently restore or automatically fall back to the legacy checker.
The active BLEGO Checker must offer exactly one provider: check.fb.tools.
There is no provider toggle and no direct scraping of Facebook pages.

## Current behavior

- Existing BLEGO Checker screen, one input area (up to 100 UIDs or links).
- One Check button, progress, row-level copies, bulk copy, manual retry and cancel.
- Requests go only through the Electron main process to the fixed HTTPS
  endpoint POST https://check.fb.tools/api/check/facebook with JSON
  inputData, userLang and checkFriends=false.
- Responses are bounded NDJSON streams; validate numeric result id and
  matching normalized origin, reject unexpected content and report errors.
- Provider valid -> LIVE; noexist -> DIE; other responses -> UNKNOWN.
  DIE is a third-party classification and is not proof of an account ban,
  advertising limitation or formal Meta deletion.
- HTTPS requests send no Cookie, access token or credentials. No redirect,
  automatic retry, CAPTCHA solving or proxy rotation.
- Existing local imported facts and owner notes are preserved. They are
  never sent to the provider.

## Removed from working branch

- Electron public-session-based direct Facebook transport,
  direct-page HTML inspector and associated diagnostics.
- Direct provider option, old ACTIVE/BLOCKED verdict logic and its
  obsolete QA scripts/tests.

Those files remain recoverable in the archive branch.

## Release gate

The provider endpoint is undocumented; its website-context behavior
has been observed, but access from an independently installed Electron
client requires verification and permitted use. HTTP 403/429, network
errors, incomplete responses and changed protocol must produce UNKNOWN,
never fabricated DIE. Verify the installed macOS ARM64 app before release.

User-requested phone-number display preference for the generator:
XXX-XXX-XXXX, e.g. 936-364-3764. This note does not itself change the
generator implementation.
