# UX3 News

Five persisted topics use the existing SQLite per-source cache. Only opening News, selecting a topic or explicit Refresh requests feeds. No startup/all-topic timer. Four workers are shared across topics; same-topic calls coalesce. A manual refresh is limited to one attempt per source per 30 seconds; ordinary revisits use the existing interval. Cancellation does not write late results. Empty/unavailable/403/429/5xx feeds preserve their last good set. Invalid dates are labelled unknown; known dates outside 30 days or >1 hour in the future are not current candidates. Unknown dates are not claimed to be current.

RSS 2.0 and Atom are parsed by the existing XML parser with size/entity limits. Redirects are bounded and each destination is resolved/checked/pinned to a public IP, including use through the host's trusted outbound proxy. Private addresses and unsafe schemes are blocked. Byte limits apply while reading, encodings respect BOM/HTTP/XML declarations, and CDATA HTML entities become readable text. Duplicates merge by normalized URL and source publication ID. Broad feeds require an explicit title/section-URL topical match; no filler or cross-topic fallback. Cards display at most 40 items, preserving original markup/skeleton/progress/refresh effects. Each title/link/source/date/author copies independently.

The only local layout addition is inline-flex alignment around new metadata copy buttons, using existing copy classes, sizing and colors. Protected CSS/assets remain unchanged. No source JSON or source-status report appears on the normal screen. Existing user source settings remain stored for compatibility; the new built-in catalog is authoritative for this UI.

## Actual source and GUI evidence

- `live-sources.json`: production transport, actual HTTP responses/content types/publisher rights declarations for every included endpoint. All 17 included feeds returned HTTP 200 on 2026-11-12. Counts are parser observations at that timestamp, not a guarantee of future availability.
- `live-news.json`, `news-*.png`: actual Electron application, selected-topic fetches and displayed unique links. Acceptance counts belong to this later application run; they are not copied from the initial candidate audit.
- Vogue UK was excluded after transport failure; VentureBeat AI and Blockworks were excluded because their returned items were stale. Economist 402/CNBC failure were not bypassed or included. Google aggregated feeds and broad FT international headlines are not used.
- `capture-live.cjs.txt`, `audit-sources.cjs.txt` retain the exact executable audit scripts. Linux x64, Electron 45.3.1. Native Mac visual/performance acceptance remains UX7.

## Publisher usage review

The catalog is a local headline/link reader, not full-article republication. Source name and available author remain visible; article links go to the original publisher, where access restrictions apply. No paywall, CAPTCHA or registration is bypassed. Endpoint rights declarations are recorded per source in `live-sources.json`; absence of a declaration is not a licence.

Official references checked via Firecrawl search and live RSS headers:
- https://www.theguardian.com/help/feeds — personal non-commercial use under Guardian terms; covers Fashion, AI and Business feeds.
- https://wwd.com/rss-feeds/ — personal non-commercial headline reading in news readers.
- https://www.marketwatch.com/site/rss — personal non-commercial use, direct links and attribution; author information retained when supplied.
- https://www.wired.com/about/rss-feeds/ — publisher-provided RSS catalog; includes Top Stories/AI.
- https://www.coindesk.com/coindesk-news/2021/09/17/coindesk-rss — publisher's RSS announcement.
- TechCrunch and The Verge home pages explicitly link RSS; remaining included feeds are served by the publishers' own domains (Vogue/Condé Nast, Ars Technica, Engadget, BBC, Cointelegraph, Decrypt). Their feed copyright/rights declarations were examined in the live audit.

This is not permission for commercial redistribution. Full site-specific reuse terms beyond the linked RSS policies are NOT_VERIFIED for Vogue, TechCrunch, Ars, Verge, Engadget, BBC, Cointelegraph and Decrypt. Their live retrieval/parser/display checks are PASS; a blanket usage-rights approval is not claimed. Application publication remains prohibited by the task.
