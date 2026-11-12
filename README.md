# BLEGO Local v1

BLEGO remains a local Electron application with its existing dark interface.
It has no application account, office server or remote file processing. Start
with Generator, Import, Archive, News, Network and Settings in the sidebar.
Existing Photos, Friends and Checker sections remain available.

**Subject classification is not implemented.** TXT/CSV/TSV/JSON are structurally
parsed and shown as `rules_pending`. That state cannot be confirmed or archived
as a classified result. A35/A8 is deferred. Archive functionality is verified
with explicitly TEST-ONLY classification fixtures, never customer rules.

## Development and verification

Use Node 24.22+ and the committed lockfile:

```sh
npm ci
node node_modules/electron/install.js
npm start
npm run verify
npm run test:ui
```

`verify` runs JavaScript syntax/whitespace checks, unit and integration tests.
`test:ui` launches real Electron via Playwright and uses temporary user data.
On headless Linux use `BLEGO_HEADLESS=1 npm run test:ui`; headless test flags are
not part of product startup. Tests do not use real user inputs, proxies or API
keys. The 10,000-issue test uses an explicitly sufficient synthetic range with
optional finite-field repetition enabled.

In Codex Cloud, writable caches and the supplied proxy can be selected without
changing HOME or disabling TLS verification:

```sh
export npm_config_cache=/tmp/blego-npm
export ELECTRON_CACHE=/tmp/blego-electron
export ELECTRON_BUILDER_CACHE=/tmp/blego-builder
export XDG_CACHE_HOME=/tmp/blego-cache
export NODE_USE_ENV_PROXY=1
npm ci
node node_modules/electron/install.js
```

See [verification baseline](docs/verification/BASELINE.md), stage reports A1–A6,
and [release evidence and acceptance](docs/verification/RELEASE.md). The original
[specification](docs/specs/BLEGO_LOCAL_V1_TZ.md) and
[plan](docs/plans/BLEGO_LOCAL_V1_PLAN.md) are preserved verbatim.

## Generator and local data

Eight countries (BR, US, FR, PL, DE, ES, IT, GB) × model/tech/crypto; type changes
bio/status/categories and field order. Contacts are mandatory. Each country has
local names and city/postal pairs inherited from the original app. These are
synthetic examples, not verified deliverable addresses. Phone formatting and
local uniqueness do not guarantee that a number has no real owner. No calls,
SMS or emails are sent; generated email domains are example.com.

Settings persist country, type, symbols, ordered fields, disabled optional
fields and explicit repetition choices. JSON overrides merge `common`,
`types[type]`, then `pairs["US:tech"]`. See
[generator data](resources/generator/README.md). Values are data, never code.
Local pools use the same registry; no account creation is offered.

The default bio/status dictionaries contain three values per country/type.
Postal/address dictionaries are also finite. `POOL_EXHAUSTED` names the field
and scope; enable optional repeats or expand the relevant dictionary. Phone,
email and handle repetition cannot be enabled. Clearing the current card or
removing an archive does not reset issuance history. Cached cards preserve their
own rules version when settings change. Uniqueness is limited to the saved
installation history; there is no cross-computer guarantee.

Data lives under Electron `app.getPath('userData')` (BLEGO/blego according to
platform configuration), outside the installation directory. `local.sqlite`
contains settings, issued-value registry, last card, operation metadata and feed
cache. It never contains a permanent duplicate of classified file text. A marker
prevents silently recreating a missing established database. Keep the whole
user-data directory, including SQLite sidecar files, together.

## Import and archives

Input limit: 50 MiB checked before File.arrayBuffer and worker dispatch. UTF-8,
UTF-16LE/BE and Windows-1251 are available; BOM/explicit selections and assumptions
are displayed. JSON keys, nested values, CSV extra cells, duplicate headers and
records are retained, with source locations. Preview pages contain 50 records;
paging does not truncate retained input. Discard/cancel releases an operation.
At most four completed in-memory operations and two readers are retained.

One confirmed classification operation produces one ZIP, with `manifest.json`,
`result.txt`, optional `unresolved.txt`, `diagnostics.jsonl`, and optionally
`source/original.<extension>`. Original copy is off by default: such an archive
is a processed result, not an exact backup of the original input. The original
file is never modified. ZIP is not encryption.

Manifest version 1 stores source hash, rules version, status/counts, per-entry
SHA256/size and separate processed/archived timestamps, processing timezone and
offset. Filename uses processing-local time, sanitized source name and full UUID.
Last successful opening is stored separately in SQLite. List/search/filter/page,
open, result copy, TXT/ZIP export, folder reveal and confirmed deletion are local.
Exports require a new destination and do not overwrite existing files.

Archive limits: 2,000 entries / 256 MiB expanded bytes, checked while reading.
Paths, symlinks, duplicates, encryption, CRC and hashes are checked. No permanent
extraction directory exists. ZIP writing uses zlib's asynchronous stream; parsed
input runs in a worker. Finalization uses a same-filesystem hard link and unlink
for atomic no-overwrite behavior; the archive filesystem must support hard links.
A failed operation is not reported as archived.

Settings can choose a new root for **future** archives. Existing archives retain
their original location; this action does not migrate or delete old files.
There is no automatic archive expiry or registry-reset button.

## Backup and recovery

Close BLEGO before copying its complete user-data directory. Preserve the
registry/settings database, archive roots, and any WAL/SHM files as a coherent
backup. Migration backups use SQLite's online backup API and integrity checks.
On migration failure the transaction rolls back; no clean replacement is made.

On startup BLEGO verifies ZIPs and resumes known verified temporary writes or
rebuilds missing catalogue entries from manifests. Recovery errors are visible
and never count as ready. Incomplete writes with no valid temporary ZIP require
reprocessing; old valid archives remain untouched. A changed/unavailable custom
root must be restored or selected again. Lost last-opened dates stay unknown.
ZIPs cannot reconstruct the generator's uniqueness history.

To restore a migration backup: close the app, preserve the current directory,
copy the verified backup to `local.sqlite` in an isolated restoration directory,
and only then reopen it. Do not delete `store-established` to conceal data loss.
Do not overwrite an open SQLite database or copy only its main file while it has
an active WAL. Test a restore on a copy before replacing working data.

## Network features

Both modules default to disabled. Proxy input is session-only; HTTP CONNECT,
HTTPS-proxy TLS and SOCKS5 remote hostname resolution are supported. Empty input
is explicitly direct connection. TLS is validated; status/schema failures,
10-second stages, 30-second overall timeout and cancellation are handled. Exit IP
uses the documented keyless HTTPS [ipify endpoint](https://www.ipify.org/).
No real user proxy was available for this verification.

Reputation adapters exist, but no vendor/key is configured. Missing data is
`not_configured`/unknown with `score=null`. BLEGO's versioned flag sum is an
uncalibrated heuristic, not a fraud probability; latency is not an input. The
main-only secret vault refuses unavailable OS encryption or plaintext fallback.
No provider keys or proxy credentials are committed or logged.

News sources are user-selected JSON `{id,name,url,topic}` objects. The legacy
[examples](resources/news/examples.json) are not an agreed final journal list.
RSS/Atom: 4 concurrent loads, 10 seconds/source, 3 redirects, 2 MiB/feed,
500 cached items/source. Refresh intervals: 15/30/60/180 minutes while the app
is open. Failure retains previous source data as stale. Unknown publication
dates are not replaced by fetch dates. Filters persist; disabling aborts work.

## Builds and platform limits

```sh
npm run dist:mac      # On macOS: DMG arm64 + x64
npm run dist:win      # On Windows: NSIS x64
npm run dist:linux    # Linux x64 test tarball
npm run pack:linux   # Unpacked Linux test app
```

Commands explicitly use `--publish never`. No application is deployed or
published. `shared/` and `resources/` are included in app.asar. Run
`node scripts/check-package.cjs release/linux-unpacked/resources/app.asar` to
check resources and exclusion of fixtures. Release output is ignored by Git.

Electron 45.3.1 requires macOS 13+ per Electron's v44 breaking-change policy.
This is an upstream minimum, **not** a verified BLEGO macOS support claim.
macOS arm64/x64 installed runs, Windows x64 installed run, Developer ID signing
and Apple notarization require their actual target environments and credentials.
None is claimed complete here; OS protections must not be disabled. See RELEASE.
The builder is pinned to 26.18.0; its installed schema is used (current website
v27 signing-schema examples do not apply unchanged to this version).

Runtime dependencies: fast-xml-parser 5.12.0, https-proxy-agent 9.1.0,
socks-proxy-agent 10.1.0, yauzl 3.4.0, yazl 3.3.1 (MIT). SQLite is embedded in
Electron/Node (SQLite public domain). Original country dictionaries and newly
authored themes follow the repository LICENSE; no external personal dataset.
Audit scope/results and build-only advisories are recorded in RELEASE.
