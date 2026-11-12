# BLEGO macOS M1 QA run 5

Run package configuration now explicitly targets only darwin-arm64, matching the user's Apple M1 requirement. Native ExifTool/Perl gate and 42 unit / 71 integration tests were PASS in the prior run, whose packaging failed only because the baseline configuration also included x64. This run must check packaging, execute the installed app and upload the unsigned DMG only if verification succeeds.
