# Local dictionaries

Country name/address dictionaries derive from the existing BLEGO repository
(see root LICENSE). Thematic text is newly authored for this project under the
same license. No scraped names, user records, or external personal datasets.
Three bios and statuses per type/language; geographic pairs retain original
country data. These dictionaries are small finite examples, not production
address verification. All telephone values are synthetic format examples;
no ownership/non-assignment guarantee, calls or SMS. Email uses example.com.

Settings accept JSON data: common → types[type] → pairs["country:type"].
Allowed overrides: bios, statuses, categories, symbols, fieldOrder, pool.
A pool contains data objects with mandatory phone/email/handle and optional
profile fields; all values pass the same uniqueness registry. No JS execution.
Default unique bios/statuses exhaust after three issues per country/type;
postal capacity depends on the country JSON. Explicit allowRepeats changes
only optional fields, never contacts. Capacity is included in each card.
