# BLEGO Mac M1 QA run 9

The prior actual installed GUI run passed the app workflow and image groups but failed copy suite after a concurrent test replaced shared global macOS clipboard with `London`. Node test runner now executes all GUI suites with test-concurrency=1, leaving each original assertion enabled. Re-test native run and upload DMG only on success.
