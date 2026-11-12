# BLEGO macOS M1 QA build trigger

This commit initiates the existing GitHub Actions workflow on the public repository's standard macos-15 (Apple Silicon M1, arm64) runner. The workflow must verify native Perl/ExifTool, run tests, build an unsigned DMG, and verify the packaged app before uploading any QA artifact. It does not merge PR #1, publish a GitHub Release, sign/notarize the app, or modify customer data.

Requested 2026-11-12 for first native macOS testing.
