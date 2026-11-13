# Final QA candidate — issue #4

Candidate version 1.3.0, QA only. No official release, merge, paid plan, Apple signing or notarization. Prior successful builds and PR #1/#3 remain untouched.

Final stabilization adds direct-network cancellation through renderer/server/transport, bounded speed reads with first-body-byte timing, honest null spread when fewer than two TCP samples exist, and proxy speed in the original animated gauge. Editing a proxy clears its prior result; in-flight input is locked and returned results are bound to the submitted value. A fresh-user regression reproduced delayed onboarding stealing navigation; the tour now starts only while the user has not begun interacting, preserving the tour and animations themselves.

Native QA workflow gates: verified embedded ARM64 Perl/ExifTool → lint/unit/integration → actual date/GEO 1/10/100 native batch → unsigned DMG → mount read-only/copy outside checkout → every GUI test discovered from tests/ui → installed 100-photo date/GEO GUI batch → original/candidate screenshots and launch/generation/frame measurements → SHA-256 → success-only artifact upload. Failures do not become successful QA artifacts. Native results are added only after the run completes.

Linux original/candidate performance harness was executed successfully; headless frame cadence is not treated as Mac animation acceptance. Main acceptance measurements must come from the native Mac job. Samples are three isolated launches per version, not cold filesystem-cache lab measurements. Native runner hardware/OS are recorded separately; performance variability is reported rather than hidden behind arbitrary thresholds.

Linux checks: `npm run verify` passed lint, 61 unit and 88 integration tests. `BLEGO_HEADLESS=1 npm run test:ui` passed all 15 tests, zero skipped. Installed-style GUI batch exported 100/100 copies in 53.13 seconds (100 progress rows, maximum sampled event-loop gap 229 ms); these are small 12×8 RGBA fixtures, not a maximum-size image stress claim.
