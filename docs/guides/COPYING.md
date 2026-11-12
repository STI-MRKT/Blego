# Copying working data

Use **Copy data…** at the top of Generator, Import, Archive, Checker, Network, News or Photos. The panel captures a model snapshot, including rows beyond the visible page. **Refresh snapshot** reads current data explicitly. Choose all rows, filtered rows or selected rows; selections persist across pages. Preview shows the row/byte count and excluded fields. Only **Copy prepared snapshot** writes that preview to the clipboard.

Formats: values, labelled values, JSON and TSV. TSV defaults to visible spreadsheet-safe mode: formula-leading values, phones and numeric IDs receive an apostrophe. Raw mode keeps exact values and can execute formulas when pasted into a spreadsheet. Single-value copying is exact. Missing input values remain empty. Field order is a JSON list (for example `["name","phone","email"]`), allowing column names containing commas; omitted fields are excluded. Full profile cards retain mandatory phone/email. Format/order preferences persist locally; profile order is separate for each country/type. Sequential copying offers previous, next, and copy-and-advance; failure does not advance.

Section sources:

| Section | Individual / grouped data |
|---|---|
| Generator | Every field, ordered card, sequential fields |
| Import | Parsed cells/rows/selection, exact source text, available diagnostics; rules_pending remains unclassified |
| Archive | Name/date/status/rules version/last opened, opened result/unresolved text and diagnostics; no internal filesystem paths |
| Facebook | String ID, canonical link, availability, reason/time, always-unknown automatic ban assessment; owner notes separately opt in |
| Network | Exit IP, available country/provider, connection/check time, score/version and allowlisted source flags; missing provider values stay empty |
| News | Actual title/source/date/link/available summary; no invented article body |
| Photos | File name, semantic tag values, warnings, before/after plan, export status/hash report |

Passwords/tokens/internal paths are excluded from grouped sources. GPS, owner names, dates, comments and metadata before/after require the explicit personal-data checkbox. Source text and archive result text also require opt-in in the panel; their dedicated exact-copy buttons are explicit single actions. No guarantee can identify every secret hidden in arbitrary free text: inspect your preview before sharing. The complete output is capped at 10 MiB UTF-8; oversize fails without replacing the clipboard and offers file export. The 5,000-character preview is shortened visibly by its scrollable preview limit; the prepared payload itself is never silently truncated.

Normal Ctrl/⌘ C and Ctrl/⌘ A remain browser/editor behavior. Ctrl/⌘ Shift C opens the panel only outside editable fields with no text selection. There are no global shortcuts. News updates defer replacing focused/selected news content. Copy errors never show success.

**Copy image pixels** transfers a PNG pixel representation through the native clipboard. It does not transfer the original image container or edited EXIF/XMP/IPTC metadata. Use **Export verified copies** in Photos for an actual edited file, and review completed/failed/cancelled results. Export reports are JSON/TXT; tag values and full paths are omitted.
