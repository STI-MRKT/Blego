# D3 — public Facebook diagnostics, 2026-11-12

The existing checker now distinguishes public page availability from account
restrictions. Every automatic result retains `banAssessment: unknown`. A 200,
`og:title`, HTTP error, login wall, checkpoint or request limit never establishes
whether the target account is banned. The legacy loopback `/api/fb/check` returns
410 without making an outbound request; there is no second live-check path.

Normalization supports IDs as strings (including leading zeros and 20+ digits),
usernames, profile.php and people/name/id URLs. It rejects spoofed hosts,
credentials, nonstandard ports and reserved service paths. Duplicate targets are
requested once while original rows retain their mappings. Input is at most 100
nonblank lines. Syntax does not prove a real account or ID namespace.

The main-owned transport checks every redirect, pins DNS lookup to checked public
addresses, validates TLS, limits redirects to five and decoded responses to 2 MiB,
and applies one 15-second deadline across the target. One target is processed at
a time, with starts at least two seconds apart. Limits/challenges pause remaining
targets; there is no proxy rotation, login, CAPTCHA handling or automatic retry.
Cancellation settles active work and filters stale run IDs. Network checks are
off by default and explicitly enabled in Settings; normalization/owner notes work
without enabling them. Quit and disabling the module cancel active work.

Interpretation prioritizes request limits/challenges/login/HTTP unavailable
responses. Profile-visible requires matched canonical target, profile type and a
matching structured Person record; unknown markup stays unknown. These are
conservative diagnostic signals, not a verified sanctions API. Manual owner reports
are separately timestamped in the existing SQLite store and not overwritten by
automatic results. No profile contact lists, biographies or raw response bodies
are persisted in history or classification ZIPs.

## Observed checks

- New profile tests initially failed (missing modules). The cancellation/deadline
  test subsequently exposed an unresolved injected transport; adding an explicit
  abort race fixed it. A 200 unavailable-message fixture first returned unknown
  and then passed after adding the specific unavailable-state interpretation.
- `node --test tests/unit/facebook-input.test.cjs tests/unit/facebook-response.test.cjs
  tests/integration/facebook-queue.test.cjs`: **6 pass**.
- `npm run verify`: **32 unit + 43 integration pass**, syntax/format pass.
- `BLEGO_HEADLESS=1 npm run test:ui`: **1 expanded real Electron workflow pass**,
  including local long-ID copy, invalid URL row, saved owner report, unknown account
  restriction display, and refusal to start networking while disabled.

Fixtures cover 200+og:title only, structured matching/mismatching profiles, login,
challenge, request-limited messages, 403/404/429, unavailable text and unknown
language. Transport tests cover hostile redirects, redirect/body limits, private
IPv4/IPv6 and a real HTTPS request blocked during an injected private DNS lookup
before connection. Virtual deadline/cancellation checks avoid real 15-second waits;
queue tests verify starts at 0/2000 ms and pause at 429. Owner notes survive checks.

**No live Facebook profile was requested during verification.** The HTML fixtures
are synthetic representative forms, not authenticated current Meta responses.
No automatic determination of account sanctions is implemented or claimed.
Unknown responses can be common; this is not repaired by guessing a verdict.
No application build, native Windows/macOS test or signing was performed in D3.
Logs: `/tmp/blego-d3-*.log`; final runs are `verify-final` and `ui-final`.
