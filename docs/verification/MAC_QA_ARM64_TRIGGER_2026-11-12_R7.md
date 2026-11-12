# BLEGO M1 QA validation — seventh run

Previous packaged GUI run revealed macOS aliases `/var` to `/private/var`, and `Meta+A` rather than `Ctrl+A` is the native text selection shortcut. The GUI tests now check canonical paths and native text selection without disabling any user-facing checks. The image group GUI suite already passed on M1. This run will release a QA-only unsigned DMG artifact if and only if the final packaged-app tests succeed.
