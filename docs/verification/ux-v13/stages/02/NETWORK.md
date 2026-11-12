# UX2 Network — evidence and methodology

Provider documentation checked 2026-11-12 via Firecrawl read-docs, then live public endpoint with built-in adapter. No subscription, signup or key added.

- https://proxycheck.io/api/ — v3 is current, but official docs explicitly retain v2 support until 2035. Existing integration uses supported HTTPS v2. `risk=1` is a 0–100 risk score; API key optional, unkeyed 100 daily requests per querying IP. We use one explicit Check request, not background polling. Trust = 100 − numeric risk, only for matching queried IP and documented range. Null/false/empty/array/string/out-of-range data produce unknown.
- https://www.ipqualityscore.com/documentation/proxy-detection-api/overview — authenticated `/api/json/ip/{key}/{IP}`, fraud_score. No configured access; independent adapter interface available, no live integration or score combination claimed.
- https://docs.scamalytics.com/ip-fraud-risk-api/v3/ — v3.2 documentation identifies integer scamalytics_score 0–100 and tiered fields. No configured account/key; not enabled.
- https://www.abuseipdb.com/api — supplied page describes key-required legacy API. Current implementation would require checking current v2 reference before activation. Abuse complaints are independent evidence, not interchangeable with primary fraud risk. Not enabled.

Live `8.8.8.8` response: proxycheck returned numeric risk 0, IP-bound result, ASN AS15169/provider Google LLC; Trust 100 was calculated from that real response. This is a public DNS test IP, **not proof of any user's proxy reputation**. See provider-live.json. Unknown update time remains null, not the current time.

Controlled integration creates real HTTP CONNECT, HTTPS CONNECT, SOCKS5 and SOCKS5h endpoints and a TLS IP origin, with valid and wrong credentials. Explicit injected endpoint resolver permits local fixtures only; IPC request cannot supply it. Production resolves and pins public proxy endpoints, blocks local/private/link-local/reserved ranges and applies safe failure codes. SOCKS5 is local DNS; SOCKS5h is remote DNS. No arbitrary request target is accepted from user input.

Transport connection timing includes connection/proxy/TLS establishment and is labelled accordingly. Direct TCP latency samples and explicit HTTPS speed are separately labelled Direct; unavailable samples remain null. Spread needs >=2 values. Speed uses actual bytes/total elapsed time including connection/TTFB, bounded to 10,000,000 bytes, 25s, abortable. Check does not automatically download a speed payload.

Limitations: no public user-supplied control proxy is available, so real public egress-IP comparison is BLOCKED; real fixed-IP provider probe is PASS. Extra providers are NOT_CONFIGURED. Direct raw TCP connectivity on cloud networks may be restricted; no fake zero samples. Native Mac measurements remain for UX7.
