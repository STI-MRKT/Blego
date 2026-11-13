# Supplemental native run started before the owner's20-photo clarification

Application96b81f414490cebd573ab1294895fd0b53c454fc; run43404761265, job131816423583. Darwin24.6.0 ARM64.

PASS: native runtime gate, lint/90unit/116integration, actual1/10/100/500/1000engine exports/readback, real photograph comparison, DMG creation/mount/copy outside checkout,27installedGUItests (337.688s,0skipped),100-file installed GUI (100outputs,63.868s,total;35.187sread,maxrenderer gap269ms).

FAIL: optional1000-folder installed GUI. It read1000files, then `locator('[data-action="metadata-export"]').waitFor()` exceeded30000ms at scripts/check-metadata-ui-batch.cjs:139 (2026-11-13T10:23:05Z). No successful1000-folder GUI export is claimed. This timeout does not establish whether preview would eventually finish; its full large-batch performance cause remains unresolved. Do not replace it with PASS based on the engine-only1000test.

Workflow stopped before final performance screenshots/checksums/installZIP publication. The earlier DMG was built but was not handed off as a fully accepted QA package. Diagnostic ZIP SHA256:88a003edd49b26799fd65cf3f927014563fbfe2db237c3252b25b093644230cb, downloaded and CRC checked; artifact14028177989 (3-day retention).

Owner independently reduced the mandatory Photos workload to20while this run was active. The new20-profile runs all unchanged general GUI tests and actual20-photo checks again; this historical failure remains visible. Application capacity was not changed or advertised as accepted1000-photo GUI throughput.
