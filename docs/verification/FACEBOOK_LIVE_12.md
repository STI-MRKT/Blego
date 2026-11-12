# Facebook current observations — v1.2

2026-11-12, Linux x86_64 Codex Cloud. Command:
`node scripts/check-facebook-live.cjs /tmp/blego-facebook-live-12.json`.
Used the existing HTTPS/DNS-guarded client, 15-second deadline, sequential queue,
no cookies, login, third-party scraping, proxy workaround or challenge solving.
Two official public organization-page targets were requested. Both returned
`network_error / NETWORK_FAILURE`; neither produced an HTTP response available
to the inspector. Ban assessment stayed `unknown`. No page body was saved.
The minimal sanitized observation is in `data/facebook-live-12.json`; ordinal
labels replace the public target URLs. The report generator completed, but that
is NOT evidence that either page was fetched or classified successfully.

E08–E11/E13–E14 are covered by current deterministic parser/queue/transport tests.
E12 and E53 remain BLOCKED for the real response corpus: no HTTP page evidence
was obtained through the production client in this environment. No live login,
429, available-profile, unavailable-profile or challenge response was verified.
The synthetic fixture corpus cannot close those gaps. Automatic ban verdicts
remain unsupported; owner notes are separate. A future authorized native/Cloud
network check must rerun the same bounded client and record only observed states.
