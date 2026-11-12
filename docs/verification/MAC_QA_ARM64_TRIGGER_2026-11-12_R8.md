# BLEGO M1 QA run 8

Run Ubuntu lint before the Mac compile, then native M1 runtime, unit/integration tests, unsigned DMG packaging and installed GUI checks. macOS temp directories are canonicalized in assertions and copy selection uses Meta+A on macOS. Any failed installed-app test prints and uploads diagnostics; artifacts are marked QA only after final verification.
