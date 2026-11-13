# BLEGO 1.4 authored supplements

`names-v14.json` is additive. The unchanged country resources and their source licenses remain authoritative; no old profile is rewritten.

- TECH: the user's 25 required names plus 250 authored thematic names. These are synthetic display names, not assertions of company ownership or trademark clearance.
- MODEL/CRYPTO: 256 added complete female name pairs per category, 32 per country. Given names come from the corresponding existing female dataset. The additional locally appropriate surnames create pairs absent from that country's old Cartesian pool. No person or population frequency is asserted. Imported country datasets retain authority over permitted given names.
- Display names now participate in the existing installation registry. A checked SQLite backup precedes the first additive historical-name index; request/profile JSON is never rewritten. Explicit name-repeat consent is respected, but emails remain unique.
- Automatically generated email local parts are normalized from display names, with a persistent numeric collision suffix. `dayrep.com` is user-specified configuration; no claim about mailbox ownership or delivery, no mail or availability request.

Naming selection indexes the existing Cartesian pool without materializing millions of combinations. Exhaustion fails before spending contacts. Old explicit local pool records retain their supplied email.

`bios-v14.json` adds 50 authored biographies for each of MODEL/TECH/CRYPTO in each supported language (en/pt/fr/pl/de/es/it): 1,050 added strings, 80 choices per localized category including the unchanged original 30. US and GB share English. These are localized authored texts, not claims about real users. Existing explicit user BIO overrides take precedence. Automated checks cover counts, normalized duplicates, retention, exhaustion and exact clipboard/history; they are not a substitute for native-speaker editorial review.
