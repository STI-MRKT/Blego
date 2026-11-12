# Final whole-branch review and fixes

Fresh read-only review, separate agent, gpt-6-astra xhigh, immutable range
6e57eab..88e76a3. Requested by executing-plans; no implementer subagents and no
second review. Reviewer found no Critical issues, five Important and two Minor;
verdict was With fixes. Declined-to-judge list: empty.

All seven findings entered one fix pass. The two nominal Minor findings were
regraded Important: copying an archive in the wrong order changes the working
result, and an ineffective Cancel command prevents users stopping a long batch.
Neither was deferred.

| Finding | Reproduction / change |
|---|---|
| EXIF owner/serial removal | Real ExifTool fixtures; corrected OwnerName/SerialNumber mapping; read-back requires their absence |
| Stale IPTC Extension GPS | Real LocationCreated/Shown GPS fixture; clear recognized extension copies and verify every surviving stored coordinate/ref, accounting for ExifTool family-4 Copy groups |
| Nested import credentials | Nested password/token and URL userinfo/query leak reproduced; massValues recursively sanitized with preview redactions, exact explicit single cells remain distinct |
| Unsafe numeric JSON ID | 12345678901234567890 rounded in the old adapter; JSON reviver now preserves unsafe numeric source lexemes; already-rounded model numbers fail before string conversion |
| Missing CSV cell shown as null | Rendered HTML test; null/undefined checked before object formatting, remains empty |
| Archive filter order | Real synthetic old/new ZIPs, GUI oldest filter copied newest first; now resolves rows in ordered filteredIds |
| Cancel reading | Two active and six queued readers reproduced; cancellation now aborts active engine signals and prevents queued starts; UI distinguishes reading/export |

Author acceptance checks also found and fixed full-profile copying dropping
mandatory contacts, shortcut opening a panel instead of copying the current
single card, concurrent clipboard/read jobs exceeding export's two-job budget,
and JPEG COM using the wrong ExifTool group (File:Comment). Each has a reproduced
red test followed by passing checks. No arbitrary customer classifier was added.

Red evidence: /tmp/blego-review-{privacy,copy,missing,order,cancel,comment}-red.log,
/tmp/blego-d7-{copy,shortcut,budget}-red.log. Profile green logs:
/tmp/blego-review-{fixes-green,privacy-final,order-green,cancel-green}.log,
/tmp/blego-d7-copy-green.log. Final full regression and packaged tests are in D7
and the E01–E32 acceptance report. This document records test-based resolution,
not a claim that a second reviewer approved the updated code.

No deferred minor findings. Remaining acceptance gates are source minima and
unperformed native/real-world/maximum-size tests, not silently waived requirements.
