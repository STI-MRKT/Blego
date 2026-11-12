# Generator data sources

## Female-name update — 2026-11-12

Only the explicitly **female** first-name arrays from `@faker-js/faker` **10.6.0**
are used for new default profiles. Generic/male first-name arrays are excluded.
These are language vocabularies, not assertions about a person's sex, nationality,
residence or identity. Some names can be used by people of different genders;
membership here follows the upstream female-name list. No linked real profiles,
contact details or household records were imported.

Source: https://github.com/faker-js/faker/tree/v10.6.0/src/locales

The published npm archive SHA-256, actually downloaded during development:
`13b79ed894af1a52a624fdb144384e1fd6c4afc1a30488830d3be64924333674`.
The archive package metadata declares MIT; the included LICENSE explicitly
describes software and data-definition ancestry. Its complete current and
inherited notices are redistributed in `licenses/faker-10.6.0.txt`. No separate
restrictive license for the extracted locale arrays was included in this package.
The data arrays, not the library runtime, are distributed in BLEGO; no application
dependency or startup download was added.

Reproduce extraction from the reviewed package in a development environment:
`node scripts/prepare-name-data.mjs /absolute/path/to/faker-10.6.0/package`.
The script verifies version/license, uses only `first_name.female`, retains Unicode,
normalizes NFKC/whitespace, rejects controls/digits and deduplicates case-insensitively.
US/GB use the English locale; this is not a country population-frequency dataset.
Polish generic surnames are adjusted for feminine `-ski/-cki/-dzki` and adjective
`-y` forms before deduplication. Examples: Kowalska, Wiśniewska, Konieczna.

Each country file records schema/dataset/version, date, normalization, provenance
and SHA-256 of `JSON.stringify` of the object excluding its checksum property.
New profiles record their dataset ID/version. Existing issued profiles, previous
request results and the uniqueness registry are preserved.

## Actual normalized counts and open deficits

Targets per country remain 500 personal names, 500 surnames, 50 localities,
200 independently verified locality–postal links and 100 street elements.
The following counts are **not** a claim that the complete D2 dataset is accepted.

| Country | Female names | Surnames | Localities | Existing postal examples | Independently verified links | Street elements |
|---|---:|---:|---:|---:|---:|---:|
| BR | 81 | 21 | 4 | 4 | 0 | 6 |
| US | 1563 | 473 | 4 | 4 | 0 | 6 |
| FR | 435 | 150 | 4 | 4 | 0 | 6 |
| PL | 163 | 710 | 4 | 4 | 0 | 6 |
| DE | 573 | 1688 | 6 | 6 | 0 | 8 |
| ES | 120 | 625 | 6 | 6 | 0 | 8 |
| IT | 617 | 2170 | 6 | 6 | 0 | 8 |
| GB | 1563 | 473 | 6 | 6 | 0 | 8 |

Female-name targets remain short in BR/FR/PL/ES; surname targets in BR/US/FR/GB.
All geographic/street targets remain short. Existing geographic resources are
inherited from BLEGO at `6e57eab`, not presented as newly externally validated.
Postal codes remain paired with their existing localities and are strings.
No digit/case/whitespace variations were invented to inflate counts.

Type resources now contain 30 distinct authored biography structures and 20
statuses for each type in English, Portuguese, French, Polish, German, Spanish and
Italian. GB/US share English. Topics differ between fashion photography,
open-source technology and blockchain research; no income promises are included.
These are BLEGO-authored texts, not extracted Faker bios. Native-speaker review of
the full set remains unperformed. Finite biographies/statuses/postal examples still
exhaust under strict rules. Increasing names does not make profiles or telephone
numbers unlimited. Generated addresses remain synthetic composites; phone formats
do not guarantee non-assignment to real subscribers.

## User data-package format

Import a JSON country dataset with the same schema and checksum convention as a
bundled country file, or a ZIP containing `dataset.json` and optional `LICENSE.txt`.
Country, language and telephone numbering parameters must match the bundled
country. Declare female-name provenance and redistribution conditions. Imports
are data, never code or configuration scripts. Duplicate or unnormalized names
and locality/postal pairs are rejected; no silent deduplication changes a supplied
checksum. Package preview shows counts/license; apply verifies unchanged file
bytes. Cancelling discards the token. Active and installed versions live in the
existing SQLite key/value store, apart from shipped resources. Switching versions
does not free issued values. A previous user version can be reselected in Settings.
Source-declared geographic verification is not independent verification by BLEGO.

Limits: 50 MiB file, 256 MiB expanded ZIP, 1024 entries, directory depth 8.
The narrowly supported ZIP schema rejects additional unexpected files. This first
package format imports country vocabularies; thematic arrays can be overridden
through existing JSON settings. No importer executes scripts or downloads data.
