# Network score display

Connection Quality retains existing measured `https-quality-1` formula:
`round(100 × successes/attempts × (0.7 + 0.2 × max(0,1−meanMs/1000) + 0.1 × max(0,1−jitterMs/200)))`.
It requires at least3attempts and2successes; otherwise N/A. This is a local heuristic over actual HTTPS round trips, not a statistical IP reputation score.
IP Trust remains100−proxycheck.io risk, only validated0–100 risk for exact displayed IP and valid expiry. Unknown/failed/missing responses remain gray N/A. No default100, speed-based trust or provider averaging.
Full meter gradient red/orange/yellow/light-green/green spans0–100 (20-point color bands); filled portion ends at actual score, with a number for non-color users. Unknown is neutral gray. API key controls removed, existing vault values untouched. Explicit reputation checkbox describes sending exit IP; no background request added. Internal transport/tests and diagnostics remain.
