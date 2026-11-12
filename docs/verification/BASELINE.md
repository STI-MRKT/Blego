# A0 — 2026-11-12, Codex Cloud / Linux x64

Cloned https://github.com/Kinetic58/BLEGO.git. Initial branch `main`, HEAD
`6e57eabfb5b51af4475b90686fa580b5ce57e9b0`; clean working tree, no existing user
storage in this fresh checkout. Work branch: `codex/blego-local-v1`. No AGENTS.md
or references/ audit archive was present. Supplied specification and plan are
copied byte-for-byte into docs/specs and docs/plans. No local PC access.

Baseline: Electron 32.3.3 (lock), electron-builder 25.x; Node v24.22.1, npm 11.9.0.
`npm ci`: first failed because default npm cache is outside writable paths;
retry with /tmp caches reached Electron download but direct GitHub connection
was refused. Proxy-aware retry recorded separately below. No build/run claim.

Commands introduced:
- `test:unit`: node:test; 2/2 PASS (countries and escaping).
- `test:integration`: node:test; 1/1 PASS (real loopback server).
- `lint`: JavaScript syntax checks and git diff whitespace; 38 files PASS.
  This is a syntax gate, not a full semantic ESLint analysis.
- `verify`: lint + unit + integration. GUI is an explicit separate gate.
- `test:ui`: Playwright Electron smoke; attempted, FAIL: executable absent
  following failed dependency installation. Not a GUI PASS.
- `node scripts/baseline-diagnostics.cjs`: exit 1, three reproduced failures:
  A11 late JSON field, A12 extra CSV cell, A13 unclosed quote. Kept as a
  regression command for A3; not substituted for full importer coverage.

Code inspection additionally identifies false clipboard success, 30-minute
card expiry, nonpersistent history, automatic network refresh, unrestricted
external URLs, and credentials in internal proxy URL. These are not runtime
validation results. No application login/admin code found.

Dependency selection (npm registry queried on this date): Electron 45.3.1,
electron-builder 26.18.0, Playwright 1.65.0; runtime ZIP yazl 3.3.1/yauzl 3.4.0,
XML fast-xml-parser 5.12.0, https-proxy-agent 9.1.0 and socks-proxy-agent 10.1.0.
Use embedded node:sqlite behind one adapter, with real Electron compatibility
probe before A1. No native addon ABI rebuild required. Electron upgrade is a
separate commit before functional integration; versions will be pinned.

Sources: https://www.electronjs.org/docs/latest/tutorial/electron-timelines/
(latest three stable majors supported),
https://www.electronjs.org/docs/latest/tutorial/security/ (sender/navigation),
https://nodejs.org/api/sqlite.html (DatabaseSync/backup).

Changed requirements vs legacy prototype: no office server/auth, contacts are
mandatory, synthetic example email domains, no automatic expiry, no invented
classification, persistent uniqueness, unknown reputation instead of low risk.
Classification acceptance A35 remains deferred throughout A0–A7.

## Separate runtime upgrade

Proxy-aware baseline `npm ci` succeeded (405 packages). Electron 45 uses the
Node fetch environment proxy: `NODE_USE_ENV_PROXY=1 node node_modules/electron/install.js`
succeeded. Runtime probe actually executed Electron 45.3.1, embedded Node
24.22.2, SQLite 3.53.4; CREATE/open/query/close works. `npm run verify` PASS:
39 syntax checks, 2 unit, 1 integration. GUI launch attempted on Linux without
DISPLAY; this is not an installed macOS/Windows validation. Playwright is pinned
locally for reproducibility. No application behavior changed in this commit.
