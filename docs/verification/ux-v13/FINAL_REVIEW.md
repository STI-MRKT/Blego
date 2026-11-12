# Whole-branch review and resolution

Fresh read-only reviewer (gpt-6-astra), range 7de5727..4fd107c plus disclosed QA-script changes, 2026-11-12. No reviewer edits or GUI execution. Strengths: strict numeric/IP-bound Trust, pinned public proxy endpoints, bounded topic cache, verified exclusive image-copy pipeline, persisted individual profile copying and preserved native runtime gate. No Critical findings.

| Finding | Review grade → final grade | Resolution and regression |
|---|---|---|
| Saved checkbox Map promoted false date-scope entries | Important | Read checkbox value as well as presence; unit covers EXIF/XMP/both/neither, Set/Remove, Map/FormData. GUI saves EXIF-only group and reopens it. RED→GREEN. |
| Early Cancel preceded settings/snapshot completion | Important | Renderer generation token exists before first await; cancel invalidates startup and late results, proxy value captured with revision. GUI delays settings and topic snapshot. RED→GREEN. |
| Late image preview replaced current/closed preview | Minor → Important | User sees the wrong image during editing. Request identity invalidated by close, selection/group/removal/clear/navigation; filename shown. GUI resolves B before A, then close/selection while A pending. RED→GREEN. |
| Direct speed/target measurements lacked independent copying | Minor → Important | Explicit owner requirement applies to each working value. Adjacent speed/target controls and direct diagnostics in existing structured copy source; missing node has no fake zero. Native clipboard checks exact values. RED→GREEN. |

The executor regraded the last two by user impact and fixed all four in one pass. No deferred minor findings. No second reviewer was dispatched.

## Rulings on reviewer “Declined to judge”

- Native Mac runtime/DMG/installed/performance: remains a separate actual workflow gate; Linux cannot substitute. Cost if mistaken: unlaunchable package.
- Public user-proxy egress/Trust: no supplied public control proxy; controlled sockets and fixed public-IP provider lookup are bounded evidence, not full egress acceptance. Cost if mistaken: unsupported deployment path.
- Live Facebook: ECONNREFUSED means network failure, not profile accessibility or sanctions. Cost if mistaken: false account verdict.
- Dictionary volume/geography: preserve FAIL and actual minima report. Cost if mistaken: exhaustion or inaccurate synthetic geography.
- RSS redistribution: headline/link retrieval and source declarations do not grant blanket commercial rights; no publication. Cost if mistaken: unauthorized redistribution.
- Full disk: fault injection proves error handling, not a physical full-volume run; state this distinction. Cost if mistaken: untested filesystem behavior.
- Visual/native animations: actual representative screenshots and animation inventories support restoration; owner/native comprehensive acceptance stays separate. Cost if mistaken: missed interaction or layout regression.
