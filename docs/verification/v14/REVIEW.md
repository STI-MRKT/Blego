# Independent whole-branch review

Scope: `782c1b2c1b61703f81542eafb8d97a33fc3264ec..050b34a90b6a580f49b08f50bbf314a2f41a9e56`, then working-tree fixes. Independent read-only reviewer, required by specification §17. No merge.

Four P2 findings were reproduced and fixed:

1. Dirty metadata form could restore old GPS after dragging a point. Draft rebasing now preserves unrelated date edits. Multiselection follow-up caught a regression: rebasing must preserve pending GPS for other photos. Per-photo exclusions now retain the moved point and other pending values; a later explicit GEO form/reference/preset edit supersedes exclusions. Actual single/two-file GUI export and independent readback PASS (2/2).
2. MultiPolygon sampling accepted a sampled point against the whole union, over-weighting overlapping component bounding boxes. Accept only within the chosen component. Disjoint triangles with overlapping boxes reproduce the former ~75% overlap-region density versus ~60.5% expected; broad statistical guard and containment checks PASS.
3. Friends import rejected some credential aliases but omitted classifier-supported `cookiesJson`, `cookie_json`, Russian aliases and `auth_token`. Reuse existing header recognition plus NFKC normalization and additional credential aliases. JSON/CSV/query-string rejection cases PASS; no imported secrets are transported.
4. Same-line records ending in cookie JSON could merge. Finalize/recognize the current cookie before deciding a record boundary; bounded balanced-JSON lookahead supports arrays, objects and reversed property order. 27 delimiter/label/payload combinations verify exact cookie ownership and source spans.

Independent follow-up: 28/28 focused backend checks PASS before the multiselection follow-up; final draft unit 1/1 PASS and inspected GUI log 2/2 PASS. Reviewer reported no remaining actionable findings. This review does not replace full regression or native acceptance.

First macOS candidate run [43401189960](https://github.com/STI-MRKT/Blego/actions/runs/43401189960) passed runtime preparation/native write-readback gate but failed one integration test before DMG creation. The collision-test interceptor compared lexical `/var` and canonical `/private/var` paths. Compare real paths and assert that the collision was actually injected; keep production filesystem guards unchanged. Fresh native run required.

Live News GUI probe uses the real service and actual rendered cards, no fixture responses: Fashion32, AI20, Crypto40, Finance32, Technology40 displayed; unique fetched32/20/59/32/65. AI2/3 source responses succeeded, other themes all configured sources. Details/timestamps/errors in `news-ui-live-linux.json`. Feed changes explain Fashion31 in the earlier service probe versus32 here.

QA-only follow-up: resource script expected the obsolete512MiB queue cap. RED reproduced; switched boundary assertions to current10GiB contract, retained actual40MP/50MiB/512MiB decode/write/cancel/retry and reference shared-budget rejection. Sparse10GiB files test actual stat/inode accounting only, explicitly not whole-corpus decoding. Independent read-only reviewer found no actionable issue; actual GREEN completed afterwards (linux/resources.json). No packaged application source changed.

Owner20-photo QA profile reviewed independently: no actionable findings. Same harness loads baseline service/engine/normalization through explicit project root; default1/10/20 and installed20files/20folder. Existing application capacity and general regression remain unchanged. Focused20and full Linux90/116/27 subsequently PASS. Native20still requires its own run; prior1000GUItimeout is retained in supplemental/NATIVE_STRESS.md.
