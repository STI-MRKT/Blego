# Synthetic fixtures only

Test files and in-memory buffers are authored examples (example.com, loopback,
short Cyrillic strings). No user input is copied here. Subject classification
fixture rules are injected only through createClassificationService with
allowTestRules:true in tests; the production composition always uses false.
The tests construct BOM/UTF16/CP1251, oversized buffers and repeated records
in memory so no large or personal input is committed.
