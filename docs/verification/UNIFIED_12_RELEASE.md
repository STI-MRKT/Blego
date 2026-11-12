# BLEGO v1.2 — кандидат, команды и ограничения

Это продолжение A0–A7/D0–D7 в STI-MRKT/Blego, ветка `codex/blego-local-v1`.
Код приложения/пакета: **9f5ced97b79970f6204b9cdda26ab28ee24c6168**.
Документация и дополнительные проверки коллизий фиксируются следующим коммитом;
они не меняют упакованные файлы приложения. Начальный HEAD: aeb8c237780088d33a1ac8c2f05549144088d192,
начальное дерево было чистым. История и main 6e57eab сохранены. Draft PR:
https://github.com/STI-MRKT/Blego/pull/1 — без слияния и публикации приложения.

## Изменения по этапам

| Этап | Коммит | Результат |
|---|---|---|
| D8 | ec7506a | Объединённые документы, baseline, схема workspace, явные операции/origin, inherit/Keep, additive KV |
| D9 | 1063417 | Группы, overrides, безопасные эталоны, preset CRUD, canonical dedup, реальные ISO/fNumber/exposureTime/focalLength |
| D10 | 1c63944 | Неизменяемые per-file планы, destination preflight, idempotence, cancel/retry/history, общие лимиты и копирование |
| D11 | abff147 | По 500 исходных GeoNames-пар для семи стран, лицензия/hashes/reproduction; честные оставшиеся minima FAIL |
| D12 | 9f865b6 | Реальные попытки FB через штатный клиент; network_error, отсутствие HTTP-корпуса явно BLOCKED |
| D13 | 2c2bac9 | Два native QA-шлюза/пробы, ресурсы runtime, runbook, версия приложения 1.2.0; чужая ОС не допускается |
| D14 | 9f5ced9 + итоговая ведомость | Реальные upgrades A7/aeb8c23, исправления независимого ревью, новый Linux-кандидат и повторная E01–E60 |

Подробный журнал фактических запусков этапов: [UNIFIED_12_PROGRESS.md](UNIFIED_12_PROGRESS.md).
Исторические отчёты E01–E32 не переписаны. Новая приёмка:
[UNIFIED_12_ACCEPTANCE.md](UNIFIED_12_ACCEPTANCE.md): **49 PASS / 2 FAIL / 9 BLOCKED**.

## Фактическая среда и команды

Codex Cloud, Debian GNU/Linux 13.6 (trixie), kernel 6.18.57 x86_64, Node 24.22.1,
npm 11.9.0, Electron 45.3.1, electron-builder 26.18.0, Sharp 0.35.5, ExifTool 13.63,
встроенный Perl 5.40.1. Доступ к ПК пользователя не использовался.

Выполненные команды (рабочий каталог `/workspace/BLEGO`):

```sh
npm_config_cache=/tmp/blego-npm ELECTRON_CACHE=/tmp/blego-electron NODE_USE_ENV_PROXY=1 npm ci
NODE_USE_ENV_PROXY=1 XDG_CACHE_HOME=/tmp/blego-cache npx --no install-electron
npm run verify
BLEGO_HEADLESS=1 npm run test:ui
node scripts/check-dictionary-minima.cjs
node scripts/check-facebook-live.cjs /tmp/blego-facebook-live-12.json
node scripts/check-metadata-resources.cjs
node scripts/check-metadata-ui-batch.cjs
node scripts/check-metadata-ui-batch.cjs --mixed
node scripts/check-metadata-native.cjs --target linux-x64 --root build/metadata-runtime/linux-x64 --report /tmp/blego-native-linux-12.json
NODE_USE_ENV_PROXY=1 XDG_CACHE_HOME=/tmp/blego-cache ELECTRON_BUILDER_CACHE=/tmp/blego-builder ELECTRON_BUILDER_COMPRESSION_LEVEL=1 npm run dist:linux
node scripts/check-package.cjs release/linux-unpacked/resources/app.asar
node scripts/check-installed-app.cjs --executable /tmp/blego-v12-installed-xrfm11tt/BLEGO-1.2.0-x64-linux/blego --report /tmp/blego-v12-installed.json
```

`npm ci`: 316 packages; Electron 45 требует отдельной отложенной установки бинарника,
которая фактически выполнена. `verify`: syntax/format, **42 unit + 71 integration PASS**.
Source GUI: **3 PASS**. Проверка minima завершилась **exit 1**, не PASS.
FB script завершился с отчётом о двух `network_error`, не с успешной загрузкой страниц.
Linux runtime probe и упаковка завершились успешно; `beforePack` дополнительно
выполнил свежий probe на SHA кандидата. Попытки darwin-arm64 и win32-x64 на Linux
были отклонены `TARGET_HOST_MISMATCH`; это не нативные тесты этих ОС.

Tar.gz распакован Python `tarfile.extractall(..., filter='data')` в новый каталог
`/tmp/blego-v12-installed-xrfm11tt`, вне checkout. Запуск настоящего бинарника оттуда:
**3 GUI PASS** — local workflows, clipboard text/image, metadata write/readback,
groups/reference, settings и restart. Тесты создают собственные временные user-data.
OS-выбор файлов в тестах управляемый; это не проверка живых Mac/Windows диалогов.
112 файлов приложения в ASAR побайтно совпали с checkout; тесты/docs/БД в пакет не вошли.

Полные результаты без пользовательских данных: [evidence12/index.json](evidence12/index.json),
[verify.txt](evidence12/verify.txt), [source-ui.txt](evidence12/source-ui.txt),
[installed-ui.txt](evidence12/installed-ui.txt), [runtime-linux.json](evidence12/runtime-linux.json),
[build-linux.txt](evidence12/build-linux.txt), [package-check.txt](evidence12/package-check.txt).

## Артефакты Cloud (не опубликованы в GitHub Releases)

| Артефакт | SHA-256 |
|---|---|
| `/workspace/BLEGO/release/BLEGO-1.2.0-x64-linux.tar.gz`, 162690854 байт | `d02c7fbd59de47aa2839e5fc5bf0542a468394fb4a195c5adcc8a4013e3eda6e` |
| `/workspace/BLEGO/release/linux-unpacked/resources/app.asar` | `b404ab636a9a9d17037d24b933964014bd4da6a8e95140e4e43b6a31387e4684` |

Также: `/workspace/BLEGO/release/BLEGO-1.2.0-SHA256SUMS.txt`, локальный runtime report
`release/native-runtime-linux-x64.json`. Старый пакет 1.1.0 не удалён. Ни tar.gz,
ни тестовые изображения, ни временные SQLite/пользовательские файлы не добавлены в Git.

## Ресурсная проверка именно кандидата

| Сценарий | Фактический результат |
|---|---|
| 100 PNG 12×8 через GUI | 100 read/completed/output, 48.293 с, max renderer gap 190 мс |
| Смешанная GUI-очередь: 12×8, 40 MP RGBA, 49 MiB PNG | 3/3 completed, 18.498 с, max renderer gap 60 мс |
| Boundary service suite | 40 MP read/write/readback; 40,005,000 pixels rejected; ровно 50 MiB read/decode; +1 byte rejected |
| Общий вход 512 MiB | Exact registration/overflow/reference accounting; затем реальное чтение всех 11 файлов, export/cancel/retry каждого |
| Отмена тяжёлой партии | 10 cancelled, затем 10 успешно повторены; completed сохранён; settle 465 мс |
| Память/время service suite | Peak parent + direct children RSS 467 MiB; 81.283 с; max Node-loop gap 1934 мс, включая синхронную подготовку фикстур |

Большие байтовые PNG имеют корректные ancillary chunks с заполнителем, а геометрия
проверена отдельным настоящим 40 MP изображением. Это не все варианты энтропии,
камер, ICC, C2PA и повреждений. Измерение RSS не является суммарной памятью всех
Electron/GPU-процессов. Подробности: [resources.json](evidence12/resources.json),
[100-ui.json](evidence12/100-ui.json), [mixed-ui.json](evidence12/mixed-ui.json).
Реальная link-коллизия, Unicode и chmod-denial Linux проверены отдельно;
неподдерживаемые hard links — контролируемый отказ: [export-boundaries.txt](evidence12/export-boundaries.txt).

## Оставшиеся ограничения и внешние зависимости

1. **Словари E02/E51 FAIL.** Женские имена ниже 500 в BR/FR/PL/ES, фамилии ниже 500
   в BR/US/FR/GB; улицы 6–8 вместо 100. GB — 6 мест вместо 50. У всех стран 0
   независимо подтверждённых пар вместо 200; GeoNames — один исходный источник,
   не независимая вторая проверка. GB.zip с частичными индексами не импортирован.
   Точные counts/deficits и лицензии сохранены в data JSON / DATA_SOURCES.md.
2. **Facebook E12/E53 BLOCKED.** Нет текущих HTTP-страниц через штатный клиент.
   Фикстуры не заменяют живой корпус. Автоматический verdict о бане не реализован.
3. **Нативная поставка E30/E54–E59 BLOCKED.** Нет macOS arm64/x64 и Windows x64
   сред/проверенных runtime/установленных пакетов. Подпись/нотариализация не
   выполнялись. Mac минимум 13.0 — декларация, не испытание. Шлюзы сохранены;
   следующий шаг описан в [NATIVE_RELEASE_12.md](../guides/NATIVE_RELEASE_12.md).
4. **Классификация DEFERRED.** Правила заказчика отсутствуют, не выдуманы и не
   запрошены в этом продолжении; rules_pending не готовность. Пропуски данных пусты.
5. Явно сохраняются group rules/presets. Membership и per-file overrides сессионные;
   после рестарта нужен новый выбор файлов/эталонов. Нет автоматического экспорта.
6. Не проверены физическое отключение питания, произвольный мировой корпус
   изображений и все реальные OS permission/window-manager случаи. Существующие
   примеры news и неизвестные reputation sources не объявлены утверждёнными.

Полной готовности продукта нет. Приложение не опубликовано, PR не слит, main не
изменён, платные сервисы не покупались, секреты/пользовательские данные в Git не добавлялись.
