# Изменённые файлы ТЗ №9

Кандидат96f40c79913a0e85183f6ecf1e1be8535aa739ce относительно5f30cf51a0f04da13975a7ecd11b96c488457623. Отдельные итоговые документы не входят в исполняемую сборку.

## Приложение

- `electron/features/facebook/inspect.cjs`
- `electron/features/geo/tiles.cjs`
- `electron/local/settings.cjs`
- `electron/main.cjs`
- `electron/preload.cjs`
- `shared/classifier-layouts.mjs`
- `shared/classifier-lexer.mjs`
- `shared/classifier-recognition.mjs`
- `shared/classifier.mjs`
- `shared/facebook-presentation.mjs`
- `src/css/ux.css`
- `src/js/ui/checker.js`
- `src/js/ui/photo-map.js`
- `src/js/utils/map-tile-loader.mjs`

## Проверки, версия и сборка

- `.github/workflows/blego-macos-qa.yml`
- `package-lock.json`
- `package.json`
- `scripts/check-classifier-v142.cjs`
- `scripts/check-public-services.cjs`
- `tests/fixtures/classifier-v142.cjs`
- `tests/integration/classifier-v142.test.cjs`
- `tests/integration/facebook-v142.test.cjs`
- `tests/integration/settings-defaults-v142.test.cjs`
- `tests/ui/app.test.cjs`
- `tests/ui/classifier-v142.test.cjs`
- `tests/ui/copy-all-sections.test.cjs`
- `tests/ui/facebook-flow.test.cjs`
- `tests/ui/facebook-v142.test.cjs`
- `tests/ui/map-city-recovery.test.cjs`
- `tests/ui/news-topics.test.cjs`
- `tests/ui/settings-defaults-v142.test.cjs`
- `tests/ui/ux-restoration.test.cjs`
- `tests/unit/classifier-v142.test.cjs`
- `tests/unit/facebook-response.test.cjs`
- `tests/unit/facebook-v14.test.cjs`
- `tests/unit/facebook-v142.test.cjs`
- `tests/unit/map-recovery.test.cjs`

## Документация и фактические журналы

- `docs/plans/BLEGO_TZ09_V142.md`
- `docs/specs/BLEGO_TZ09_V142.md`
- `docs/verification/tz9/INSTALL-RU.txt`
- `docs/verification/tz9/audit-regressions.cjs`
- `docs/verification/tz9/baseline/audit-red.txt`
- `docs/verification/tz9/baseline/gui.txt`
- `docs/verification/tz9/baseline/npm-ci.txt`
- `docs/verification/tz9/baseline/verify.txt`
- `docs/verification/tz9/classifier/gui-corrected.txt`
- `docs/verification/tz9/classifier/gui-first.txt`
- `docs/verification/tz9/classifier/metrics-linux.json`
- `docs/verification/tz9/classifier/red.txt`
- `docs/verification/tz9/classifier/verify.txt`
- `docs/verification/tz9/facebook/gui-corrected.txt`
- `docs/verification/tz9/facebook/gui-first.txt`
- `docs/verification/tz9/facebook/live-linux.json`
- `docs/verification/tz9/facebook/red.txt`
- `docs/verification/tz9/facebook/verify.txt`
- `docs/verification/tz9/final/audit-green.txt`
- `docs/verification/tz9/final/classifier-linux.json`
- `docs/verification/tz9/final/consumer-green.txt`
- `docs/verification/tz9/final/consumer-red.txt`
- `docs/verification/tz9/final/edge-green.txt`
- `docs/verification/tz9/final/edge-red.txt`
- `docs/verification/tz9/final/gui-before-review.txt`
- `docs/verification/tz9/final/gui-reviewed.txt`
- `docs/verification/tz9/final/lint-reviewed.txt`
- `docs/verification/tz9/final/npm-ci.txt`
- `docs/verification/tz9/final/public-services-linux.json`
- `docs/verification/tz9/final/verify-before-review.txt`
- `docs/verification/tz9/final/verify-reviewed.txt`
- `docs/verification/tz9/map/gui-red.txt`
- `docs/verification/tz9/map/gui.txt`
- `docs/verification/tz9/map/unit-red.txt`
- `docs/verification/tz9/map/verify.txt`
- `docs/verification/tz9/review/REVIEW.md`
- `docs/verification/tz9/review/map-green.txt`
- `docs/verification/tz9/review/unit-green.txt`
- `docs/verification/tz9/review/unit-red.txt`
- `docs/verification/tz9/review/visibility-red.txt`
- `docs/verification/tz9/settings/gui-corrected.txt`
- `docs/verification/tz9/settings/gui-first.txt`
- `docs/verification/tz9/settings/red.txt`
- `docs/verification/tz9/settings/verify.txt`

Защищённые tokens/base/components/shell/tools/views CSS и графические ресурсы не менялись. Единственное локальное CSS-правило в ux.css исправляет скрытое состояние новой кнопки Retry; сохранение графики дополнительно оценивается по снимкам нативного приложения, а не только по diff CSS.
