# BLEGO macOS M1 QA diagnostic run

Previous run compiled an ARM64 DMG and passed 42 unit and 71 integration tests but installed-GUI smoke test failed. This run retains the same gates and prints/uploads diagnostic logs on failure to isolate actual cause. Artifacts are accepted as QA only after the packaged-app test passes.
