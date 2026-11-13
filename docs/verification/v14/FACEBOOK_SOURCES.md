# Facebook data boundaries — BLEGO 1.4

Official source consulted on 2026-11-13: https://developers.facebook.com/docs/graph-api/reference/user/ (live fetch HTTP 200, page displays Graph API v27.0).

The User reference requires a User access token and `public_profile`; default authorized fields include id/name/picture. It explicitly describes `id` as app-scoped and unusable by other apps. A public numeric Facebook ID alone therefore does not authorize arbitrary Graph API User queries. No authorized app/user access has been supplied for this task. API-backed external acceptance is **BLOCKED**; no imported credential is used and no API request or login flow was invented.

Anonymous public HTML is separately diagnosed. PROFILE_VISIBLE requires matching requested/final/canonical target, og:type=profile and an identity-bound JSON-LD Person. Only that matched Person can supply name/type and a validated HTTPS fbcdn image URL. Image URLs are displayed/copiable, not automatically fetched. An isolated title/image, redirect/login page, 403/404, CAPTCHA, timeout or DNS failure never proves account sanctions. `banAssessment` remains unknown.

Statuses: PROFILE_VISIBLE, UNAVAILABLE, LOGIN_REQUIRED, CHALLENGE_REQUIRED, RATE_LIMITED, NETWORK_ERROR, UNKNOWN, CANCELLED. Existing lower-case availability is retained for compatibility. HTTP status, safe reason code, source, actual checkedAt and duration are recorded; unattempted queue items have checkedAt=null and attempted=false. DNS/TLS/timeout/refusal/reset/unreachable reasons are distinct and contain no raw exception text.

Queue: one request at a time, ≥2 seconds between starts. Rate-limit/challenge responses stop remaining requests. Retry-After seconds/HTTP dates persist in the existing SQLite store; explicit retry and restart cannot bypass the cooldown. Remaining targets receive an honest queue explanation. A missing/invalid Retry-After applies a conservative one-minute pause.

Local import association is an explicit per-record action in classifier details. Only ID/profile URL, name, avatar URL and row number are passed to the local facts store. Conflicting ID/profile URL rejects association. Passwords, email passwords, cookies and tokens are neither passed to the checker nor used for requests. Local facts are labelled “Из импортированного файла; не проверено Facebook” and never become public evidence or affect status. Owner notes remain separate.

Controlled transport/GUI fixtures test available statuses and actions; they are not live Facebook acceptance. Two real anonymous public brand-page requests are documented separately in facebook-public-linux.json, including failures. No cookies, credentials or raw page bodies are retained in that report.
