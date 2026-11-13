# Facebook stage

The existing normalization, public-response parser, serial 2-second rate limit, queue and cancellation remain in use. One explicit Check now validates and checks public availability; the button itself authorizes that network action. Results distinguish availability, login, restriction, connection error and insufficient evidence; account restrictions always remain unknown. Owner statements and history are secondary disclosures and never replace measured availability. Per-value copy uses existing clipboard services.

Run identity is assigned before asynchronous startup. Cancel/Clear invalidates it immediately, so delayed normalization/settings/results cannot resurrect a cancelled check. Editing input marks prior results as stale. The public endpoint policy now shares the already-tested network guard instead of maintaining a second range list.

GUI coverage: one synthetic long ID including leading zeroes, 100 synthetic IDs, URL normalization, per-element native clipboard, hidden owner notes, cancellation and absence of BANNED/NOT_BANNED. Backend integration retains 429 pause, unknown responses, deadlines and cancellation. GUI fixtures are explicitly synthetic and do not prove Facebook service availability.

`facebook-live.json` records fresh anonymous requests to official public organization pages, no login/cookies/tokens/CAPTCHA workaround. A network failure/restriction is an observed limitation, not an account-ban conclusion. Broader live public-profile availability remains BLOCKED when the environment or Facebook refuses requests.

Stage results: `npm run verify` PASS (lint, 61 unit, 81 integration); all 11 Electron GUI tests PASS. Fresh live attempts both produced NETWORK_FAILURE, with banAssessment unknown; representative real availability remains BLOCKED, not PASS.
