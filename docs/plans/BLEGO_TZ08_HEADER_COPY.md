# TZ8 — finish PR9, remove general header copy controls

Plan identity: docs/plans/BLEGO_TZ08_HEADER_COPY.md. Execute inline with one fresh whole-change review under executing-plans; retain current PR9 and branch.

Base: codex/blego-fp-bio-independent at cdc72c4c8b600b4d41b5b7f88232190c6fb75a08.
Received PR9 HEAD: 5c30c7e9b9a4a2d32735eafd6c90953d7796cd4f. Working tree clean. No AGENTS.md found. No merge/release/history rewrite.

Binding requirements: remove injected general copy buttons from all10 named views including FP/BIO/Settings, at UI construction level; keep all individual copies, exact FP full-set/national phone, classifier full cookie/export contracts, BIO independence/autosave, existing clipboard engine; advanced panel via Ctrl/Command+Alt+Shift+C and existing Ctrl/Command+Shift+C behavior. Do not intercept text editing/selection. No stale record, automatic reopening, empty-data error, hidden layout obstruction or duplicate listeners. Width360 through1280. Fresh installed ARM64 QA and ZIP, screenshots and SHA256 required.

- [x] 1. Audit existing change; npm ci. Extend existing regression test and add focused failing cases for panel lifecycle/keyboard races before product edits. Fix within copy-actions.js and only necessary local panel styles. Preserve tests' copying assertions.
- [x] 2. Required commands: npm run lint, test:unit, test:integration, test:ui, verify. Sequential GUI. Fresh whole-change review; reproduce/fix important findings RED→GREEN; final regression. Separate logical commits and actual outcomes.
- [ ] 3. Enable this branch in existing gated ARM64 workflow. Push checked candidate [mac-qa-run], mount/install outside checkout, full GUI plus FP/BIO screenshots, exact artifact and inner DMG verification, update existing PR9. No release/merge.

Review focus: source identity changes while a menu/shortcut is pending; navigation to an unsupported section and back; empty sources; text/select/contenteditable keyboard targets including macOS physical KeyC; multiple mounts, repeated events and tiny windows; no full-set or direct-copy format changes.

Ruling: keep existing explicit prepared snapshots while their record context is unchanged; invalidate on navigation, replacement/clear of records or import reset. Use existing copy engine and selection/format preferences; no second clipboard implementation.

Stage1 evidence: received single GUI test PASS, initial lint FAIL on new test formatting. npm ci PASS. Added real GUI regressions RED on unsupported-navigation resurrection, contenteditable interception and late archive reads. Lazy mount/context invalidation and text/repeat guards GREEN4/4. Expanded fullGUI41/42 exposed empty-source preview invalid one-card scope; fixed source scope. Additional RED showed empty preview overwrote generator preferences with order=[]; zero-row previews now leave preferences unchanged. Final targeted4/4 PASS10.840s. Existing FP full-set format and direct value paths retained. Common verify after final fix running.
Ruling: panel wrapper only gets a zero-size fixed position; all existing colors, effects, controls and responsive bounds retained. Explicit same-record prepared snapshots remain supported; record/navigation changes invalidate pending work. Empty preview uses an empty collection, not a nonexistent card, and must not change full-set preferences.
Stage1 final common verify: lint PASS,123 unit/127 integration PASS, no skips. All four focused GUI tests PASS. Added capture readiness after inspecting a blank transition-frame screenshot; finite screenshot animations are completed for capture, with product animations unchanged. Full regression still running.

Stage2: fresh whole-change reviewer found one important photo-group identity gap and one minor sequential-copy completion race; both reproduced RED in real Electron, then fixed in the existing module. Focused6/6 PASS13.418s; latest verify lint PASS,123/123 unit,127/127 integration (53.106s), zero skips. Full GUI final pass pending.

Final Linux regression after review fixes:44/44 GUI PASS185.584s, zero skipped/cancelled; npm run verify PASS123 unit/127 integration. Product correction committed separately. Candidate native QA remains pending.

Native attempt1 d14929d: runtime/readback, verify, metadata batches, real photograph and DMG PASS. Installed GUI43/44 PASS, archive-v141 test FAIL due two overlapping legitimate save notifications matching one strict locator; all6 new copy tests PASS. Installer withheld. Scope test notification to the current save, keep all content/restart checks. Targeted archive GREEN1/1; fresh verify123/127 PASS, full Linux GUI repeat running while new native candidate starts. Application code unchanged since7173a1e.
