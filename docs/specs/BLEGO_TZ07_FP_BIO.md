# TZ7 — independent FP and BIO generators

User request, 2026-11-13. Base `codex/blego-v1-4-1-fixes`, SHA5a63ee7e5177459ebe4aed6a9c143df5cfeda341. Feature branch `codex/blego-fp-bio-independent`; preserve the confirmed base and PR7.

One sidebar Generator entry contains permanent tabs **ФП | BIO**, visible with no generated data. FP retains its original card/avatar/layout and all later name/BIO pools, @dayrep.com, national phone copy, address→city→postal order, individual/full copying, clear and history. No additional-fields disclosure.

BIO is standalone: own country, city, theme, Generate BIO, seven existing biography fields, individual copy/edit/regenerate, autosave and restart restoration. Its synthetic personal biographies can use model/tech/crypto themes independently of FP's brand naming strategy. Reuse existing verified organizations, regional matching, blank missing data, synthetic disclaimer and atomic persistence. No Save BIO.

Generation, clear, parameters, results and identifiers are independent in both directions. Tab switching never generates. No original records, archives, registry or databases are deleted. Legacy attached BIOs can be opened without duplicate records or rewriting the FP.

Implementation decision: use namespaced records and workspace parameters in the existing SQLite kv table, no schema migration or new DB. Reuse the existing biography selection engine and debounce coordinator. Initialize a stable legacy pointer once; resolve legacy records without copying on read, then create an independently editable record under a deterministic legacy BIO identifier on first edit. Original requests remain unchanged. Paginated history opens both legacy and new BIOs. Clear removes the current pointer, retaining history.

City input supports reference/local dictionary suggestions and free text; absent reliable data remains blank. A source-confirmed postcode can accompany a selected unambiguous locality to preserve existing safeguards. Parameters describe the next generation; saved-result regeneration uses that result's original parameters. Normal close flushes both parameter and value editors.

Rejected approaches: renaming Profile alone leaves mandatory coupling; adding another DB/selection engine duplicates existing storage and rules. No optional FP-to-BIO copy command is needed for independence.

Acceptance: all twelve user scenarios in source tests and installed macOS ARM64 Electron; broad regression checks, honest source/signing/owner-acceptance limits, no merge or official release.
