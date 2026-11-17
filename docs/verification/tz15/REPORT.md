# BLEGO TZ15 — installation QA candidate

- Parent: approved TZ14 PR #20, frozen SHA `084f21feedc8d9edbba37e280c9de5459fb53133`.
- Draft PR #21; do not merge or publish an official release.
- Classifier: bounded, deterministic per-record inference recognizes primary/account and mail credentials when evidence is sufficient; unique `!123–12345` mail-password signature, strong ID/date/person/email anchors, optional second e-mail `backupEmail`; ambiguous inputs remain for manual mapping. `::`, `;`, `|`, `:`, repeated `=` and `-` section boundaries.
- UI: removed bottom classifier additional and field-mapping panels; slim inline field-mapping and direct archive/export/source copy remain.
- New generated BIO/FP status presentation: terminal dot removed, themed emoji attached without altering persisted legacy card values.
- Checker: integrated the code from approved FB.Tools-only PR #17 on top of TZ14. Deprecated direct HTML/HTTP Facebook provider archived separately on `archive/blego-facebook-direct-legacy-20261117`. This undocumented third-party provider is not an official Meta account-ban determination.
- Privacy: real passwords and cookies are never used in GitHub test fixtures or diagnostics. Only fabricated synthetic credentials.
- [Linux test run 44092546229 — PASS](https://github.com/STI-MRKT/Blego/actions/runs/44092546229): lint, targeted TZ15 classifier/generator and FB.Tools tests, full unit/integration and targeted native Electron GUI including mixed credentials, second email, copy/reveal.
- Native macOS ARM64 signed-off acceptance and installed DMG QA: pending this run. No validated installer before Mac checks pass. Apple Developer ID signing/notarization absent.

## Acceptance criteria
Installed Mac app must pass selected GUI regression suite `tz15`, native ExifTool read/write/readback, classifier quality checks and ZIP+DMG SHA-256. A live public control request to check.fb.tools is recorded separately because vendor results and access can change independently of application code.

## Follow-up native QA

The first installed macOS ARM64 run [44092982608](https://github.com/STI-MRKT/Blego/actions/runs/44092982608) completed native ExifTool and full verification and passed 20 of 21 scoped GUI tests. One legacy unified-copy GUI fixture still expected the retired direct-provider label `LOGIN_REQUIRED`; the accepted FB.Tools-only implementation intentionally shows `LIVE` in that controlled fixture. The assertion was updated, with no changes to runtime code. Re-run installed-app acceptance on this candidate before installer publication.
