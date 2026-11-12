# UX4 Facebook Checker

One Check action normalizes single or multiline IDs/links, then explicitly enables and invokes the existing public-check service. Original textarea, buttons, animated result rows and progress bar are retained. Every ID, link, human-readable status/reason, timestamp and owner-note value can be copied independently. Owner notes/history are behind a disclosure; they remain separate from public observations. No new backend, storage or classifier was introduced.

Original target normalization, strict host/redirect/address checks, sequential 2-second queue, response interpretation, rate-limit pause, run IDs and cancellation are retained. Cancellation invalidates the current renderer run before awaiting IPC; late responses cannot replace Cancelled. Editing completed input marks the previous result. MODULE_DISABLED remains an actual backend guard and is tested before the GUI fixture is installed.

Deterministic GUI fixtures exercise a login wall, a long numeric ID without numeric coercion, mobile-link normalization, batch targets, independent native clipboard readback, cancel during the active request and late response rejection. These fixtures are labelled test-only and do not alter production transport.

Real anonymous request: https://www.facebook.com/facebook using the unchanged production fetchPublicProfile transport on Linux x64. It returned `network_error` / `NETWORK_FAILURE`, with a separate diagnostic confirming `ECONNREFUSED` / `AggregateError`. No page body, cookie or token was retained. Public-page accessibility acceptance is BLOCKED by the current network route; no available/unavailable Facebook verdict was inferred. `banAssessment` remains `unknown`. See facebook-live.json. Native macOS network behavior remains UX7.
