# Local dictionaries

See [DATA_SOURCES.md](DATA_SOURCES.md) for current licensing, source hashes,
normalization, counts and open quality deficits. New profiles use only upstream
female-name lists. Seven country files now contain 500 GeoNames source-paired
localities; GB retains 6 full-code examples. Independent postal confirmation is
still pending. Type resources have 30 bios and 20 statuses per type/language.
All profiles/contact strings are synthetic; no claim of a real person's identity
or an unassigned phone number is made. Email uses example.com.

Settings apply common → types[type] → pairs[country:type]. Optional repeated
fields never relax contact uniqueness. Existing cards, issued values and imported
datasets remain in the same SQLite store and registry. Capacity is finite and
reported honestly; see `node scripts/check-dictionary-minima.cjs` for unmet targets.
