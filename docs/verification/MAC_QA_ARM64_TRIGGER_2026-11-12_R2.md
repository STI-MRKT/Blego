# BLEGO macOS M1 QA rerun (second attempt)

Reason: The original Linux-specific unit test expected a Mac package to be rejected, even after a correctly verified Mac runtime was prepared. The test now deliberately simulates a failing native probe on the active host and asserts packaging is blocked. Actual native probe separately passed JPEG, PNG and WebP on the Mac M1 runner before the former test failure.

Run the unchanged fail-closed native gate, all tests, unsigned ARM64 DMG packaging, installed app tests, and artifact upload.
