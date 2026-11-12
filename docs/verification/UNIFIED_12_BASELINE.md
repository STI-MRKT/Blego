# v1.2 / D8 baseline — 2026-11-12

Actual HEAD and origin/codex/blego-local-v1: aeb8c237780088d33a1ac8c2f05549144088d192.
Branch codex/blego-local-v1; initial git status --short empty. Main remains
6e57eabfb5b51af4475b90686fa580b5ce57e9b0. No reset, new project or branch replacement.
PR https://github.com/STI-MRKT/Blego/pull/1 remains a draft. Origin STI-MRKT/Blego;
upstream Kinetic58/BLEGO preserved. No applicable AGENTS.md found in repository/parents.

Uploaded v1.2 spec/plan/acceptance template saved at the requested paths. The attached
continuation TXT was read as supporting material; the chat request controls scope.
Prior specs now link to the unified revision; A/D commits and acceptance history remain.
New acceptance table initially NOT_RUN throughout; old PASS values are historical only.

Environment: managed Codex Cloud, Linux x86_64, running/connected, unrestricted network,
no configured secrets/native signing bindings. No access to the user's PC. Native Mac
and Windows execution is not available in the selected environment. No new service,
purchase, publication, PR merge or signature authorization inferred.

## Existing owners and extensions

| Requirement | Existing owner | Extension |
|---|---|---|
| SQLite / schema / rollback / backups | electron/local/store.cjs + migrations/001.cjs | Additive metadata:workspace KV; no new DB/schema reset |
| Group drafts / explicit operations | metadata:presets in image service | shared/image-workspace.mjs + images/groups.cjs; explicit save only |
| Image engine / copy verification / queue | electron/features/images/{service,engine,export,policy,write-policy,files,structure}.cjs | Resolve per-file operations into the same exporter |
| IPC / clipboard | electron/main.cjs, preload.cjs, local/ipc.cjs | Named group/reference APIs, same copy-format/copy-sources |
| Generator / registry / imports | electron/features/generator/{service,sources,catalog,registry}.cjs | D11 resources only; issued history retained |
| Country/type datasets | resources/generator/countries/{BR,US,FR,PL,DE,ES,IT,GB}.json; types/{model,tech,crypto}.json | Document provenance/minima independently |
| Facebook | electron/features/facebook/{normalize,inspect,transport,service}.cjs | D12 current observations, no ban-verdict change |
| UI | src/js/ui/photos.js, main.js, state.js | Existing dark styles; grouped editor rather than duplicate app |
| Packaging | scripts/{prepare-metadata-runtime,metadata-before-pack}.cjs | D13 target probe and installed checks, retain gate |

Baseline command `npm run verify`: syntax/format PASS; 38 unit / 57 integration PASS.
Log /tmp/blego-d8-baseline.log. This is a new baseline run, not copied old counts.
E02 dictionary/geography deficits, E12 real Facebook coverage and E30 target native
platforms remain open. No subject classification rules supplied or inferred.

## D8 model decisions

Effective priority: explicit file operation (Keep included) → group snapshot → Keep.
Inherit exists only in draft overrides and is resolved before export. Every new Set
requires manual/preset/reference provenance; that label is not proof of real authorship.
The existing operation validator was moved into shared/metadata-operations.mjs and is
reused by policy and workspace, not duplicated. Legacy metadata presets retain their
original representation and order.

Explicit Save group settings stores group names/operations only. File memberships,
per-file overrides, selections and destination/file permissions are session-only and
are clearly named as such in the save result/UI; reopening cannot authorize old tokens.
No filesystem schema migration is needed for an additive KV entry. Existing transaction
rollback/backups remain the single owner's responsibility.
