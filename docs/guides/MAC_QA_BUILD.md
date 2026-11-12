# BLEGO — тестовая сборка macOS

Ветка подготовки: `codex/macos-qa-bootstrap-20261112`, ответвлена от `codex/blego-local-v1` на `0f72a89cbc1cbfbb31a9bb576dbba2ef7fcdb220`. Она **не заменяет рабочую ветку**, не сливает PR №1 и не публикует Release.

## Что добавлено

- `scripts/prepare-metadata-darwin.sh`: собирает Perl 5.40.1 из официального архива, сверяет SHA-256, упаковывает модули и лицензии для реальной архитектуры Mac;
- `scripts/make-runtime-manifest.cjs`: фиксирует SHA-256 каждого файла и проверяет неизменность среды;
- `scripts/prepare-metadata-runtime.cjs`: в macOS передаёт подготовку нативному сценарному файлу;
- `.github/workflows/blego-macos-qa.yml`: собирает **только после явного запуска**, выполняет native-проверку JPEG/PNG/WebP, тесты, создаёт DMG и проверяет собранное приложение вне репозитория.

Фактические проверки на macOS ещё не выполнялись. Код не гарантирует успешную сборку без запуска на настоящем Mac.

## Запуск без облачных расходов — на своём Mac

Для первого прохода нужны Xcode Command Line Tools и Node.js 24.22.1 (либо совместимая версия 24.x). В отдельной рабочей папке:

```bash
git clone --branch codex/macos-qa-bootstrap-20261112 --single-branch https://github.com/STI-MRKT/Blego.git BLEGO-mac-qa
cd BLEGO-mac-qa
npm ci
node node_modules/electron/install.js
npm run prepare:metadata
node scripts/check-metadata-native.cjs --target darwin-$(node -p 'process.arch') --root build/metadata-runtime/darwin-$(node -p 'process.arch') --report release/native-mac.json
npm run verify
npm run dist:mac -- --$(node -p 'process.arch')
```

Затем проверить приложение в `release/mac-<arch>/BLEGO.app` и выходной DMG. Не удалять карантин и не отключать Gatekeeper. Сборка неподписанная и не нотариализована; на чужой машине запуск может блокироваться ОС.

## GitHub Actions: осознанный запуск

Репозиторий **private**. Стандартный macOS runner использует включённый лимит GitHub Actions и может стать платным при его исчерпании. Текущая цена стандартного macOS runner по GitHub Docs — $0.062 за минуту. Job имеет лимит 60 минут, что даёт до $3.72 вычислительной стоимости одного запуска, плюс возможное хранение артефактов, если включённого лимита недостаточно. Проверить бюджет организации заранее.

Веточная задача запускается **только** отдельным коммитом в этой ветке с маркером `[mac-qa-run]` (Apple Silicon) или `[mac-qa-run-x64]` (Intel). Обычные коммиты эту задачу пропускают. Из-за ограничения GitHub `workflow_dispatch` интерфейс ручного запуска может быть недоступен, пока workflow не добавлен в основную ветку; переносить его в `main` без согласования не следует.

Успешный запуск поместит приватный QA-артефакт `BLEGO-mac-*-QA` в Actions (срок хранения пять дней). Это не GitHub Release. Если native-проверка или установленный GUI-тест не прошли, готовый артефакт не публикуется.

## Отдельное условие для привычной установки

Для запуска скачанного DMG без предупреждений macOS требуется процедура подписания Developer ID и нотариализации через авторизованный Apple Developer Account. Эта ветка не получает секреты и не пытается обойти системную защиту. Предметный классификатор по-прежнему `rules_pending`.
