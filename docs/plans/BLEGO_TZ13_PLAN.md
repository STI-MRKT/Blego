# TZ13 classifier correction

Branch `codex/blego-tz13-classifier`; base `35226e5a1a071eb534408641b63a922915840caf`.
Worktree `/workspace/BLEGO-tz13`. No changes to unrelated UI, News, FP or BIO.

The reported original TXT is not available in this session yet. Synthetic fixtures
are the reproducible development contract; original-file acceptance remains pending.
Never commit, print, or upload real source credentials. Keep raw source handling local.

## Audit

- Mixed TXT lexing splits tabs before associating labels with values. `Login FB`
  can become a spaced `login` label with `FB` as its value.
- `ID Account` and `Date of Birth` aliases are absent.
- Header/schema recognition currently outranks global manual mapping.
- Existing copy/row/core7/archive services already preserve canonical values and
  maintain confidential 2FA provenance; reuse them and retain their regression tests.

## Implementation sequence and impact

| Change | Verification |
|---|---|
| Synthetic tab-label fixtures and tests | Coordinator runs RED before implementation |
| Explicit TXT label/value framing and aliases | Parser/classifier unit tests; exact source spans, literal secrets, unknown labels, ambiguity and record boundaries |
| Manual mapping precedence | TXT/CSV/TSV/JSON unit and worker reclassification; preserve 2FA source restrictions |
| Worker, copy and archive contracts | Focused classifier integration and GUI with synthetic data |
| 1.4.5 QA packaging/workflow | Selective classifier native tests, installed binary outside checkout, ZIP/DMG digests |

Prefer an isolated explicit tab-label parser before the existing mixed TXT lexer;
header tables and user-selected schemas continue through their existing paths.
Treat tab-framed payloads literally: no trimming, separator splitting or JSON-string
unquoting of passwords/tokens. Unknown labelled fields remain raw/unrecognized.
Known conflicting labels remain ambiguous, with no arbitrary winner. Row-level
manual assignment outranks column assignment; both outrank header/schema inference.

Preserve existing SQLite, raw source, core7 field order, copy/row/export/archive and
confidential-source policies. No test disabling or blanket full-suite repeats.
The coordinator executes tests as shell/CI processes under the user's model choice.
No push, PR, merge or official release from the implementation agent.
