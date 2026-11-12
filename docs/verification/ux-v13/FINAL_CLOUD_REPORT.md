# BLEGO1.3.0 — UX restoration / итог QA-кандидата

Дата:2026-11-12. Подготовлен тестовый ARM64-кандидат для совместной оценки. **Полная готовность продукта не заявлена:50 PASS,2 FAIL,8 BLOCKED в повторной ведомости E01–E60.**

[Рабочая ветка](https://github.com/STI-MRKT/Blego/tree/codex/blego-original-ux-v13). **SHA кода в DMG: 41efeec35efe2443e3f78d3dbd0f808f20778d70**. Последующие коммиты меняют только QA evidence workflow и документацию. SHA последнего отчётного коммита доступен в истории этого файла и финальном сообщении; его нельзя подменять SHA проверенного бинарного кандидата.

Исходный визуальный эталон6e57eabfb5b51af4475b90686fa580b5ce57e9b0; функциональная база7de572764e4f09c5b1a542fbec22161bd1be9f42. Экспериментальная ветка не стала визуальным эталоном. История, основной worktree, БД/registry/ZIP/clipboard сохранены. Main/PR№1 не менялись, слияния и официального релиза нет.

## Сборка и фактические доказательства

[Скачать QA ZIP с BLEGO-1.3.0-arm64.dmg](https://github.com/STI-MRKT/Blego/actions/runs/43267402388/artifacts/13966903150).
Артефакт152678532байт; срок хранения до2026-11-17 17:24UTC. Доступ определяется GitHub/видимостью репозитория, не является обещанием приватности. API на момент завершения сообщает public; настройки видимости не менялись.

**SHA256 DMG:** `4508b9c062c802c3fc4c4d22d03651b3336de226e8cc3bbb74265da55e583fac`.

SHA256 внешнего ZIP: `71b2a8c2bdef2c13d0d7cb1207125ea4d07dbd792a9e8f14aaef26e34463fe00`. Это другая сумма, её нельзя сравнивать с DMG.

- [Основной native run43267402388](https://github.com/STI-MRKT/Blego/actions/runs/43267402388): SUCCESS.
- [Независимая загрузка/хеширование этого артефакта](https://github.com/STI-MRKT/Blego/actions/runs/43269473103): SUCCESS; фактический DMG hash совпал с SHA256SUMS-mac.txt.
- [NATIVE_FINAL_EVIDENCE.json](NATIVE_FINAL_EVIDENCE.json): native runtime, installed report, метрики, checksum и SHA.
- ОС:macOS15.8.2 build24H232, darwin24.6.0 ARM64, **Apple M1 (Virtual)**. Физический Mac владельца не использовался.
- Node24.22.1, Electron45.3.1, builder26.18.0, Sharp0.35.5/libvips8.18.7, ExifTool13.63, встроенный Perl5.40.1. Native probe с пустым PATH прошёл наJPEG/PNG/WebP; interpreter не подменялся системным.
- `npm run verify`: lint PASS,48unit/84integration PASS,0fail/0skip.
- `npm run dist:mac -- --arm64`: DMG фактически создан после native gate; запрет cross-platform упаковки не снят.
- `hdiutil attach -readonly -nobrowse ...` → `ditto <mounted DMG>/BLEGO.app $RUNNER_TEMP/BLEGO-qa.app` → `node scripts/check-installed-app.cjs --executable .../Contents/MacOS/BLEGO --report ...`: PASS всех10GUI-сценариев вне checkout. Данные тестов временные и синтетические.
- `node scripts/check-metadata-resources.cjs`, installed `check-metadata-ui-batch.cjs` и `--mixed`: PASS.
- `node scripts/capture-ux-candidate.cjs`: original и installed candidate снимки/animation inventory/измерения PASS,1280×900,одинаковая тёмная тема. В артефакте папка `visual/`.
- Подпись приложения пропущена builder при CSC_IDENTITY_AUTO_DISCOVERY=false. DeveloperID, нотариализация и Gatekeeper **не PASS**. Успешный запуск на runner не доказывает запуск скачанного unsigned DMG на любом Mac.

Linux Codex Cloud Debian13/x64 также реально выполнил verify48/84,sourceGUI10,pack:linux,package-byte comparison и installedGUI10 на том же41efeec3. До разрыва среды проверены /tmp/blego-v13-final-installed/blego и actual package resources. Исходные логи финальных source проверок закоммичены в [stages/07](stages/07/); поздние незакоммиченные Linux-отчёты оставлены в недоступном worktree. Native evidence в GitHub не зависит от сохранности этой среды.

## Изменения по этапам

| Этап/коммит | Сделано | Проверки этапа |
|---|---|---|
|0 ·487487e|Audit трёх контрольных точек, builds, снимки, animation/control inventory, утверждённый минимальный дизайн.|Baseline lint42unit71integration3GUI, реальные Linux builds; [AUDIT.md](AUDIT.md).|
|1 ·739c1ac|Исходные gauge/packets/avatar/cards/sidebar; Archive внизу; отдельное копирование значений, расширенное копирование вторично.|42unit71integration4GUI; визуальные снимки.|
|2 ·7103aa8|HTTP/HTTPS/SOCKS5/SOCKS5h,auth/TLS/IP/тайм-аут/cancel/private-host guard; прямые измерения отдельно; строгий proxycheck Trust.|45unit77integration4GUI; реальные контролируемые sockets, реальный provider response.|
|3 ·33bc465|Оригинальные News cards/skeleton/refresh,5тем17источников,selected-topic cache/dedup/encoding/redirect/rate limits.|47unit80integration5GUI; живые источники и отображение.|
|4 ·9813aea|Один Check дляID/ссылок/списка, понятные публичные статусы, cancel, копирование отдельных данных; notes/history раскрываются.|47unit80integration6GUI; live FB network_error отдельно от fixtures.|
|5 ·318c166|Оригинальная Photos grid/миниатюры; явные Date taken/GPS; EXIF/XMP scope и timezone Keep/Set/Remove; preview/copy-on-write.|47unit84integration7GUI; реальные JPEG/PNG/WebP и отмена.|
|6 ·e414641|Шесть основных полей профиля; отдельные handle/bio/категории; компактный Archive, поиск/сортировка/экспорт/подтверждение удаления.|47unit84integration8GUI; TXT и ZIP bytes, сохранение данных.|
|7 ·4fd107c,41efeec3|Native QA pipeline, полная независимая review; исправлены scope при save, ранний Cancel, позднее image preview, копирование прямых измерений.|48unit84integration10GUI; native runtime/DMG/installed/load/capture PASS.|
|Evidence ·423d476|Повторная загрузка готового DMG и независимое хеширование после потери Cloud shell.|Checksum match PASS; продукт не пересобирался.|

[Карта функций: control→handler→операция→результат/ошибка→тест](FUNCTION_MAP_CANDIDATE.md), [исходный audit control inventory](FUNCTION_MAP.md), [независимая review и её закрытие](FINAL_REVIEW.md). Каждый reviewer finding воспроизведён RED→GREEN; отложенных minor findings нет. Ниже приведены текущие ограничения, которые review не могла закрыть.

Защищённые src/css/{tokens,base,components,shell,tools,views}.css, icons и исходные графические ресурсы не менялись. Локальные добавления используют существующие компоненты: новые copy controls, перенос длинного handle, date/GPS layout. Визуальное подтверждение основано также на реальных снимках и проверке экранов, а не только на CSS diff. [Сравнительные Linux снимки](stages/07/comparisons.html), [generator/archive](stages/06/), [Photos с preview/export](stages/05/). Финальные Mac пары original-*/candidate-* лежат в visual/QA-артефакта; после потери среды они не прошли отдельный ручной просмотр исполнителем. Полная визуальная приёмка владельца остаётся открыта.

## Реальные Network и News

Контрольные HTTP CONNECT,HTTPS CONNECT,SOCKS5(localDNS),SOCKS5h(remoteDNS) выполняют реальный запрос к TLS IP-origin в integration tests, с верными/неверными credentials. Это не доказательство выхода через публичный прокси владельца: такой контрольный маршрут не предоставлен, **BLOCKED**. Не считать открытый порт исправным прокси.

Live proxycheck.io для8.8.8.8 вернул risk0/100; Trust100 получен только как100−0 для этого IP, не как оценка пользовательского прокси. Повторено на41efeec3. Отсутствующие/false/пустые данные дают unknown. Остальные провайдеры не подключены, платные тарифы/ключи не добавлялись.

Дополнительная фактическая проверка в Cloud17:19UTC: TCP до четырёх узлов недоступен, значения null, не0. HTTPS-download10000000байт:33.1Mbps,2418мс,TTFB1886мс через наследуемый Cloud outbound proxy. Это замер этой среды, не домашней сети/публичного прокси; controlled cancellation/limits проверены отдельно.

Финальный installed Linux кандидат, production pinned-DNS news transport, без fixture feeds:

| Тема | Источников / успешных | Получено | Валидных уникальных | Показано уникальных | Последняя загрузкаUTC |
|---|---:|---:|---:|---:|---|
|Fashion|3/3|72|25|25|2026-11-12 17:17:46|
|Artificial Intelligence|3/3|50|50|40|17:17:54|
|Cryptocurrency|3/3|92|92|40|17:18:00|
|Finance|3/3|107|34|34|17:18:01|
|Technology|5/5|120|66|40|17:18:07|

Результаты до финального прогона с полными sourceStates и снимками: [stages/03](stages/03/). Финальные числа выше зафиксированы фактическим прогоном после41efeec3; его локальные JSON/PNG не успели попасть в Git из-за потери среды. Результаты не гарантируют будущую доступность RSS. Издательские RSS declarations/policies исследованы; коммерческое переиздание всех источников не объявлено разрешённым. Контент — заголовки/ссылки/атрибуция, без обхода paywall/CAPTCHA.

Facebook production transport повторно проверил публичные facebook/Meta URLs: network_error/NETWORK_FAILURE,banAssessment unknown. Synthetic200/login/403/404/429/challenge fixtures прошли; живой репрезентативный корпус **BLOCKED**, ложных BANNED/NOT_BANNED нет.

## Photos и производительность

Native probe реально записал и перечиталJPEG,PNG,WebP с неизменными оригиналами, pixel/payload/ICC/alpha/orientation invariants. Full integration и installed photos GUI дополнительно проверили явную дату2024-02-29T12:34:56,GPS0/0,namespace selection,timezone per-file,группы/пустые defaults/cancel. Сохранение scope после group-save/restart исправлено и покрыто новой регрессией. No overwrite и permission/ENOSPC paths проверены; физически заполненный диск не создавался.

Измерения на Apple M1(Virtual), один automation sample; overhead включён, статистическую эквивалентность не утверждаем:

| Метрика | Original | Candidate |
|---|---:|---:|
|Первое доступное действие|1672мс|1030мс|
|Generate|1119мс|666мс|
|Network navigation|109мс|49мс|
|Network frame interval mean/max,60samples|16.66/19.1мс|16.67/19.5мс|
|Первая photo thumbnail|37мс|354мс|
|Archive navigation|51мс|81мс|

Photos включает новый авторизованный metadata read/thumbnail pipeline; оригинал только отображал картинку. Это объясняет часть дополнительной задержки, но оптимизация первой миниатюры и оценка воспринимаемой скорости остаются P2. Разница Archive мала в этом одном замере; нужна проверка владельцем на его данных. Живая загрузка новостей на Mac в этих visual samples не измерялась: external requests специально блокировались для сравнения графики; реальные News измерены отдельно в Linux.

Native100малыхPNG:100read/100completed/100outputs за37.127с,maxGUIgap167мс. Mixed3файла(малыйRGBA,40МПRGBA,49МиБPNGpadding):3/3 за11.185с,maxGUIgap141мс. Resource suite512МиБ:11файлов,10cancelled после одногоcompleted,selective retryPASS; cancel settled122мс. Peak sampled RSS644МиБ — только parent наmacOS, не вся process tree. Границы используют синтетические padding/geometry; это не любой реальный camera/ICC/entropy corpus.

## Повторная ведомость E01–E60

История [UNIFIED_12_ACCEPTANCE.md](../UNIFIED_12_ACCEPTANCE.md), [ADDENDUM_01_ACCEPTANCE.md](../ADDENDUM_01_ACCEPTANCE.md) сохранена. PASS ниже относится к названной проверке на новом кандидате, а не к автоматическому переносу старого результата.

| ID | Новый статус | Проверка / предел |
|---|---|---|
| E01 | PASS | Сохранены A/D-история и владельцы SQLite/реестра/ZIP/clipboard; upgrade tests. |
| E02 | FAIL | Объёмы словарей и независимая проверка географии ниже требуемых minima. |
| E03 | PASS | 24 страна×тип, женские имена, обязательные контакты: generator-diversity/female. |
| E04 | PASS | Unicode, транслитерация, строковые ID/индексы: unit/integration/GUI. |
| E05 | PASS | 10000 выдач на искусственном тестовом диапазоне с перезапуском; не ёмкость bundled-пула. |
| E06 | PASS | Честное исчерпание до расходования контактов: generator-registry/diversity. |
| E07 | PASS | Preview/apply/cancel пакета данных и сохранность активного набора: app/pool tests. |
| E08 | PASS | Длинные Facebook ID и мобильные ссылки без округления: normalize/GUI. |
| E09 | PASS | Host/DNS/private/redirect guards: facebook/network/proxy boundary tests. |
| E10 | PASS | HTTP200/title/login не становятся ban-вердиктом: response fixtures. |
| E11 | PASS | 403/404/429/challenge/timeout раздельны; sanctions unknown: controlled tests. |
| E12 | BLOCKED | Реальные запросы Facebook дали network_error; репрезентативный живой корпус не проверен. |
| E13 | PASS | FB cancel/runId/late events: queue и GUI. |
| E14 | PASS | Заметки владельца отделены от автоматического результата; storage/GUI. |
| E15 | PASS | Фактические запись/удаление/readback JPEG/PNG/WebP. |
| E16 | PASS | Пустые/смешанные/Unicode, Keep/Set/Remove, дата/зона/GPS0. |
| E17 | PASS | Original bytes, encoded payload, RGBA, alpha, ICC, orientation проверены. |
| E18 | PASS | Известные конфликтующие GPS/личные теги; без обещания полной анонимности. |
| E19 | PASS | Provenance, animation, corrupt/unsupported fixtures явно отклонены. |
| E20 | PASS | Безопасные argv/allowlist, отключённая внешняя конфигурация ExifTool. |
| E21 | PASS | Cancel/source changed/readback mismatch/write failures. ENOSPC — инъекция, не полный физический диск. |
| E22 | PASS | 100 малых PNG: реальный installed GUI read/export; большие границы отдельно. |
| E23 | PASS | Значения копируются отдельно; расширенное полное копирование сохранено. |
| E24 | PASS | Выделение/фильтры/51 строка/пагинация из модели: copy-all-sections. |
| E25 | PASS | Табы/кавычки/переносы/формулы/длинные ID: copy-format/precision. |
| E26 | PASS | 10МиБ и отказ/mismatch clipboard; никакой обрезки или ложного успеха. |
| E27 | PASS | Массовый отчёт безопасен по умолчанию; личные поля — явный выбор. |
| E28 | PASS | Клавиатура/фокус/последовательность: native GUI; ручная эргономика отдельно. |
| E29 | PASS | Буфер bitmap отдельно от файла с метаданными; actual native clipboard. |
| E30 | BLOCKED | Сводный старый критерий включает macOS x64/Windows/подпись; они не закрыты ARM64-run. |
| E31 | PASS | Upgrade реальной временной A7-базы сохраняет ZIP/registry/card/settings. |
| E32 | PASS | Новый lint +48unit+84integration+10GUI, без skipped. |
| E33 | PASS | Новые metadata values только явно; пустые исходные формы, без времени ОС/IP/случайности. |
| E34 | PASS | Group create/rename/delete/move/select; исходные файлы неизменны. |
| E35 | PASS | Inherit/Keep и разные overrides; false date-scope не становится выбранным после save/restart. |
| E36 | PASS | Общие лимиты100/50МиБ/512МиБ/40МП/two-worker; boundary/resource tests. |
| E37 | PASS | Изменение формы/selection/source/destination инвалидирует прежний план. |
| E38 | PASS | Effective group operations и идемпотентный запуск: group-export. |
| E39 | PASS | Офлайн editor/reference/preview/export работают локально. |
| E40 | PASS | Реальные camera fields, даты/offset/GPS write/readback; unsupported rejected. |
| E41 | PASS | Только выбранные reference fields; missing не очищает target, source hash проверяется. |
| E42 | PASS | Нет автоматического переноса identifiers/orientation/ICC; safe report. |
| E43 | PASS | Preset CRUD/JSON import и malformed atomicity; legacy presets сохраняются. |
| E44 | PASS | Group save/restart; session file tokens не восстанавливаются скрыто. |
| E45 | PASS | Selective retry failed/cancelled; completed не экспортируется повторно. |
| E46 | PASS | Group/all cancel, сохранение completed, изоляция runId. |
| E47 | PASS | Unicode/exclusive collisions/read-only/hard-link refusal; без перезаписи. |
| E48 | PASS | Group/filter/model scope/order/safe/raw/focus/10МиБ копирование. |
| E49 | PASS | 100-small и mixed40МП/49МиБ GUI;512МиБ read/export/cancel/retry. Синтетические padding/geometry caveats. |
| E50 | PASS | Actual A7/aeb8c23 temporary-store migration: ZIP hash/registry/presets/notes/settings. |
| E51 | FAIL | Новые minima/лицензии/независимые postal-пары не выполнены; дефицит не скрыт. |
| E52 | PASS | Смена пакета не освобождает выданные контакты; фактическое ограничивающее поле. |
| E53 | BLOCKED | Живые FB network_error отделены от synthetic fixtures; все виды публичных профилей не покрыты. |
| E54 | PASS | Нативный darwin-arm64 runtime read-write-readback gate и beforePack gate прошли в run43267402388. |
| E55 | BLOCKED | Новый darwin-x64 runtime не запускался; ARM64 не переносится на x64. |
| E56 | BLOCKED | Installed ARM64 automated subset PASS; мышь в системных диалогах, реальные OS denial/Gatekeeper и физический M1 ещё не приняты. |
| E57 | BLOCKED | Новая installed macOS x64 проверка не выполнена. |
| E58 | BLOCKED | Developer ID/notarization не предоставлены; защиты ОС не отключались. |
| E59 | BLOCKED | Windows native/installed run не выполнен для кандидата. |
| E60 | PASS | Новый SHA, повторные проверки, эта ведомость и ограничения; полной готовности не заявлено. |

## Оставшиеся ограничения

- **P1:** публичные контрольные прокси/сравнение действительного egressIP ещё не приняты; Cloud TCP недоступность не превращена в нулевой ping.
- **P1:** живой Facebook corpus отсутствует; network_error не устанавливает доступность профиля или санкции.
- **P1:** E02/E51 — словарные minima/независимые географические postal-пары не выполнены; женский генератор работает в пределах фактических наборов и честно сообщает exhaustion.
- **P1:** физический Mac владельца, системные диалоги мышью/Finder/реальные OS-denial/Gatekeeper,DeveloperID/notarization не приняты. Native ARM64 automated subset PASS; E56 шире этого subset.
- **P1:** предметные правила классификации отложены; rules_pending не означает готовность классификатора. Недостающие поля импорта остаются пустыми.
- **P2:** первая thumbnail медленнее оригинала; дальнейшая оптимизация и пользовательская оценка. Mac live News latency, full physical disk, полный ручной визуальный/hover/animation аудит всех экранов не закрыты.
- **P2:** дополнительные reputation providers без доступа не подключены; коммерческие RSS redistribution rights не подтверждены для всех издателей.
- macOSx64/Windows не тестировались заново в ARM64-задаче; прежние результаты не перенесены.
- Cloud workspace стал unavailable после push кода. Незакоммиченные report drafts не удалялись; их последующая сверка потребует восстановления этой среды. Этот отчёт и native evidence сохранены через GitHub на той же ветке.

## Установка и совместная оценка

1. Скачать QA ZIP выше, извлечь DMG. Выполнить `shasum -a 256 BLEGO-1.3.0-arm64.dmg`, сравнить с суммой в этом отчёте.
2. Закрыть старую BLEGO, сохранить резервную копию пользовательских данных и старого приложения; не удалять registry/storage. Открыть DMG, скопировать BLEGO.app в Applications.
3. Запустить установленную копию. При блокировке Gatekeeper зафиксировать точный текст и остановиться; системную защиту не отключать, quarantine командами не снимать. QA-run не является нотариализацией.
4. Проверить отдельное копирование каждого поля,5Newsтем,разрешённые контрольные прокси,FBID/links/cancel,явные Date/GPS и output readback на тестовыхJPEG/PNG/WebP. Оригиналы сохранять. Проверить Archive export/confirm-delete только на тестовой записи.
5. Проверить Cmd/clipboard/системные диалоги/перезапуск/исходную графику на физическом M1. Сообщать ошибки без паролей/секретов/пользовательских файлов в Git.

Это передача QA-кандидата на совместную оценку, не финальная приёмка владельцем и не официальный выпуск.

## Решения исполнителя и отложенные замечания

- Сохранён уже созданный изолированный worktree и versioned ledger: helper scripts облачных skills отсутствовали локально. Цена ошибки — ручная сверка ledger; исходные работы не перезапускались.
- Использован уже существующий ограниченный GitHub Actions native workflow в рамках явно заказанной Mac-сборки, без покупки/подписки/изменения spending limits. Billing API403 не позволял подтвердить бюджет; бесплатность не заявлялась. Цена ошибки — использование настроенного бюджета организации. API позднее показал public repository; раннее слово «private» не является гарантией доступа.
- После потери Cloud shell сохранён код41efeec3 и незакоммиченные drafts; отчётные Git-коммиты выполнены через GitHub, checksum готового артефакта проверен отдельным bounded Ubuntu job. Цена ошибки — необходимость сверить оставшиеся drafts при восстановлении среды. Приложение не пересобиралось/не публиковалось.
- По finishing-a-development-branch выбранное пользователем сохранение ветки без merge/release исполнено без повторного меню. Цена ошибки — интеграция остаётся отдельным решением владельца.
- Все7 пунктов reviewer «Declined to judge» сохранены в [FINAL_REVIEW.md](FINAL_REVIEW.md): native/physical acceptance,publicproxy,liveFB,dictionaries,RSSrights,physicaldiskfull,полныйvisual. Они закрываются только своими доказательствами; иначе цена ошибки — ложная готовность/неверный сетевой вердикт/потеря данных либо неподтверждённые права. Native automated часть теперь проверена, остальные пределы перечислены выше.
- Четыре code-review findings исправлены; **отложенных minor code-review замечаний нет**. Функциональные ограничения выше не переименованы в завершённые функции.

## Изменённые файлы

Полный diff к функциональной базе: [7de5727…ветка](https://github.com/STI-MRKT/Blego/compare/7de572764e4f09c5b1a542fbec22161bd1be9f42...codex/blego-original-ux-v13).
Ниже список до финального отчётного коммита; защищённых визуальных файлов среди изменений нет.

<details><summary>Файлы кода, проверок, документов и снимков</summary>

```text
.github/workflows/blego-macos-qa.yml
.github/workflows/blego-qa-artifact-evidence.yml
docs/plans/BLEGO_ORIGINAL_UX_V13_DESIGN.md
docs/plans/BLEGO_ORIGINAL_UX_V13_IMPLEMENTATION.md
docs/verification/ux-v13/AUDIT.md
docs/verification/ux-v13/CHANGED_FILES.txt
docs/verification/ux-v13/FINAL_CLOUD_REPORT.md
docs/verification/ux-v13/FINAL_REVIEW.md
docs/verification/ux-v13/FUNCTION_MAP.md
docs/verification/ux-v13/FUNCTION_MAP_CANDIDATE.md
docs/verification/ux-v13/NATIVE_FINAL_EVIDENCE.json
docs/verification/ux-v13/PROGRESS.md
docs/verification/ux-v13/REVIEW_PACKAGE.md
docs/verification/ux-v13/SHA256SUMS.json
docs/verification/ux-v13/audit-feeds.cjs.txt
docs/verification/ux-v13/baseline/classic-reference-audit.json
docs/verification/ux-v13/baseline/classic-reference-checker.png
docs/verification/ux-v13/baseline/classic-reference-generator-empty.png
docs/verification/ux-v13/baseline/classic-reference-generator-hover.png
docs/verification/ux-v13/baseline/classic-reference-generator-loading.png
docs/verification/ux-v13/baseline/classic-reference-generator-result.png
docs/verification/ux-v13/baseline/classic-reference-history.png
docs/verification/ux-v13/baseline/classic-reference-import.png
docs/verification/ux-v13/baseline/classic-reference-network.png
docs/verification/ux-v13/baseline/classic-reference-news.png
docs/verification/ux-v13/baseline/classic-reference-photos-loaded.png
docs/verification/ux-v13/baseline/classic-reference-photos.png
docs/verification/ux-v13/baseline/classic-reference-settings.png
docs/verification/ux-v13/baseline/confirmed-mac-base-audit.json
docs/verification/ux-v13/baseline/confirmed-mac-base-checker.png
docs/verification/ux-v13/baseline/confirmed-mac-base-generator-empty.png
docs/verification/ux-v13/baseline/confirmed-mac-base-generator-hover.png
docs/verification/ux-v13/baseline/confirmed-mac-base-generator-loading.png
docs/verification/ux-v13/baseline/confirmed-mac-base-generator-result.png
docs/verification/ux-v13/baseline/confirmed-mac-base-history.png
docs/verification/ux-v13/baseline/confirmed-mac-base-import.png
docs/verification/ux-v13/baseline/confirmed-mac-base-network.png
docs/verification/ux-v13/baseline/confirmed-mac-base-news.png
docs/verification/ux-v13/baseline/confirmed-mac-base-photos-loaded.png
docs/verification/ux-v13/baseline/confirmed-mac-base-photos.png
docs/verification/ux-v13/baseline/confirmed-mac-base-settings.png
docs/verification/ux-v13/baseline/experimental-reference-audit.json
docs/verification/ux-v13/baseline/experimental-reference-checker.png
docs/verification/ux-v13/baseline/experimental-reference-generator-empty.png
docs/verification/ux-v13/baseline/experimental-reference-generator-hover.png
docs/verification/ux-v13/baseline/experimental-reference-generator-loading.png
docs/verification/ux-v13/baseline/experimental-reference-generator-result.png
docs/verification/ux-v13/baseline/experimental-reference-history.png
docs/verification/ux-v13/baseline/experimental-reference-import.png
docs/verification/ux-v13/baseline/experimental-reference-network.png
docs/verification/ux-v13/baseline/experimental-reference-news.png
docs/verification/ux-v13/baseline/experimental-reference-photos-loaded.png
docs/verification/ux-v13/baseline/experimental-reference-photos.png
docs/verification/ux-v13/baseline/experimental-reference-settings.png
docs/verification/ux-v13/baseline/original-audit.json
docs/verification/ux-v13/baseline/original-checker.png
docs/verification/ux-v13/baseline/original-generator-empty.png
docs/verification/ux-v13/baseline/original-generator-hover.png
docs/verification/ux-v13/baseline/original-generator-loading.png
docs/verification/ux-v13/baseline/original-generator-result.png
docs/verification/ux-v13/baseline/original-history.png
docs/verification/ux-v13/baseline/original-import.png
docs/verification/ux-v13/baseline/original-network.png
docs/verification/ux-v13/baseline/original-photos-loaded.png
docs/verification/ux-v13/baseline/original-photos.png
docs/verification/ux-v13/capture-baseline.cjs.txt
docs/verification/ux-v13/classic-risk-reproduction.json
docs/verification/ux-v13/comparisons.html
docs/verification/ux-v13/control-inventory.json
docs/verification/ux-v13/feed-audit.json
docs/verification/ux-v13/git-audit.json
docs/verification/ux-v13/installed-linux-baseline.json
docs/verification/ux-v13/logs/baseline-linux-build.txt
docs/verification/ux-v13/logs/baseline-source-gui.txt
docs/verification/ux-v13/logs/baseline-verify.txt
docs/verification/ux-v13/logs/installed-linux-baseline.txt
docs/verification/ux-v13/logs/original-linux-build.txt
docs/verification/ux-v13/stages/01/ux1-generator-result.png
docs/verification/ux-v13/stages/01/ux1-green.txt
docs/verification/ux-v13/stages/01/ux1-network.png
docs/verification/ux-v13/stages/01/ux1-red.txt
docs/verification/ux-v13/stages/01/ux1-ui.txt
docs/verification/ux-v13/stages/01/ux1-verify.txt
docs/verification/ux-v13/stages/02/NETWORK.md
docs/verification/ux-v13/stages/02/provider-completeness-red.txt
docs/verification/ux-v13/stages/02/provider-live.json
docs/verification/ux-v13/stages/02/stale-result-red.txt
docs/verification/ux-v13/stages/02/target-red.txt
docs/verification/ux-v13/stages/02/ui.txt
docs/verification/ux-v13/stages/02/verify.txt
docs/verification/ux-v13/stages/03/NEWS.md
docs/verification/ux-v13/stages/03/audit-sources.cjs.txt
docs/verification/ux-v13/stages/03/capture-live.cjs.txt
docs/verification/ux-v13/stages/03/entities-red.txt
docs/verification/ux-v13/stages/03/live-news.json
docs/verification/ux-v13/stages/03/live-sources.json
docs/verification/ux-v13/stages/03/news-ai.png
docs/verification/ux-v13/stages/03/news-crypto.png
docs/verification/ux-v13/stages/03/news-fashion.png
docs/verification/ux-v13/stages/03/news-finance.png
docs/verification/ux-v13/stages/03/news-tech.png
docs/verification/ux-v13/stages/03/relevance-red.txt
docs/verification/ux-v13/stages/03/topics-red.txt
docs/verification/ux-v13/stages/03/ui.txt
docs/verification/ux-v13/stages/03/verify.txt
docs/verification/ux-v13/stages/04/FACEBOOK.md
docs/verification/ux-v13/stages/04/facebook-live.json
docs/verification/ux-v13/stages/04/gui-green.txt
docs/verification/ux-v13/stages/04/gui-red.txt
docs/verification/ux-v13/stages/04/ui.txt
docs/verification/ux-v13/stages/04/verify.txt
docs/verification/ux-v13/stages/05/PHOTOS.md
docs/verification/ux-v13/stages/05/cancel-ui.txt
docs/verification/ux-v13/stages/05/capture.txt
docs/verification/ux-v13/stages/05/date-green.txt
docs/verification/ux-v13/stages/05/date-red.txt
docs/verification/ux-v13/stages/05/group-date.txt
docs/verification/ux-v13/stages/05/gui-red.txt
docs/verification/ux-v13/stages/05/photos-export.png
docs/verification/ux-v13/stages/05/photos-preview.png
docs/verification/ux-v13/stages/05/photos-primary.png
docs/verification/ux-v13/stages/05/ui.txt
docs/verification/ux-v13/stages/05/verify.txt
docs/verification/ux-v13/stages/06/GENERATOR_ARCHIVE.md
docs/verification/ux-v13/stages/06/archive.png
docs/verification/ux-v13/stages/06/generator.png
docs/verification/ux-v13/stages/06/green3.txt
docs/verification/ux-v13/stages/06/photos-export.png
docs/verification/ux-v13/stages/06/photos-preview.png
docs/verification/ux-v13/stages/06/photos-primary.png
docs/verification/ux-v13/stages/06/red.txt
docs/verification/ux-v13/stages/06/ui-final.txt
docs/verification/ux-v13/stages/06/ui.txt
docs/verification/ux-v13/stages/06/verify-final.txt
docs/verification/ux-v13/stages/07/batch-100.txt
docs/verification/ux-v13/stages/07/batch-mixed.txt
docs/verification/ux-v13/stages/07/candidate-audit.json
docs/verification/ux-v13/stages/07/candidate-checker.png
docs/verification/ux-v13/stages/07/candidate-generator-empty.png
docs/verification/ux-v13/stages/07/candidate-generator-hover.png
docs/verification/ux-v13/stages/07/candidate-generator-loading.png
docs/verification/ux-v13/stages/07/candidate-generator-result.png
docs/verification/ux-v13/stages/07/candidate-history.png
docs/verification/ux-v13/stages/07/candidate-import.png
docs/verification/ux-v13/stages/07/candidate-network.png
docs/verification/ux-v13/stages/07/candidate-news.png
docs/verification/ux-v13/stages/07/candidate-photos-loaded.png
docs/verification/ux-v13/stages/07/candidate-photos.png
docs/verification/ux-v13/stages/07/candidate-settings.png
docs/verification/ux-v13/stages/07/comparisons.html
docs/verification/ux-v13/stages/07/dictionary-minima.json
docs/verification/ux-v13/stages/07/final-ui.txt
docs/verification/ux-v13/stages/07/final-verify.txt
docs/verification/ux-v13/stages/07/installed-linux.json
docs/verification/ux-v13/stages/07/installed-linux.txt
docs/verification/ux-v13/stages/07/original-audit.json
docs/verification/ux-v13/stages/07/original-checker.png
docs/verification/ux-v13/stages/07/original-generator-empty.png
docs/verification/ux-v13/stages/07/original-generator-hover.png
docs/verification/ux-v13/stages/07/original-generator-loading.png
docs/verification/ux-v13/stages/07/original-generator-result.png
docs/verification/ux-v13/stages/07/original-history.png
docs/verification/ux-v13/stages/07/original-import.png
docs/verification/ux-v13/stages/07/original-network.png
docs/verification/ux-v13/stages/07/original-photos-loaded.png
docs/verification/ux-v13/stages/07/original-photos.png
docs/verification/ux-v13/stages/07/pack-linux.txt
docs/verification/ux-v13/stages/07/package.txt
docs/verification/ux-v13/stages/07/resources.txt
docs/verification/ux-v13/stages/07/review-cancel-red.txt
docs/verification/ux-v13/stages/07/review-copy-red.txt
docs/verification/ux-v13/stages/07/review-green.txt
docs/verification/ux-v13/stages/07/review-preview-red.txt
docs/verification/ux-v13/stages/07/review-scope-green.txt
docs/verification/ux-v13/stages/07/review-scope-red.txt
docs/verification/ux-v13/stages/07/review-scope-ui-red.txt
docs/verification/ux-v13/stages/07/verify.txt
electron/features/facebook/transport.cjs
electron/features/images/date-policy.cjs
electron/features/images/engine.cjs
electron/features/images/export.cjs
electron/features/images/service.cjs
electron/features/images/write-policy.cjs
electron/features/news/feeds.cjs
electron/features/news/service.cjs
electron/features/proxy/assessment.cjs
electron/features/proxy/providers.cjs
electron/features/proxy/proxycheck.cjs
electron/features/proxy/service.cjs
electron/features/proxy/transports.cjs
electron/local/network-safety.cjs
electron/main.cjs
electron/preload.cjs
electron/server.cjs
package-lock.json
package.json
scripts/capture-ux-candidate.cjs
scripts/check-installed-app.cjs
scripts/check-metadata-resources.cjs
scripts/check-metadata-ui-batch.cjs
shared/copy-sources.mjs
shared/image-workspace.mjs
shared/metadata-operations.mjs
shared/news-catalog.mjs
src/js/main.js
src/js/services/network.js
src/js/services/news.js
src/js/state.js
src/js/ui/checker.js
src/js/ui/generator.js
src/js/ui/history.js
src/js/ui/network.js
src/js/ui/news.js
src/js/ui/photos.js
src/js/ui/settings.js
src/js/ui/shell.js
src/js/utils/copy-actions.js
tests/fixtures/facebook-ui.cjs
tests/integration/image-date-scope.test.cjs
tests/integration/network-diagnostics.test.cjs
tests/integration/news-cache.test.cjs
tests/integration/news-topics.test.cjs
tests/integration/proxy-boundaries.test.cjs
tests/integration/proxy-transports.test.cjs
tests/ui/app.test.cjs
tests/ui/archive-actions.test.cjs
tests/ui/copy-all-sections.test.cjs
tests/ui/early-cancel.test.cjs
tests/ui/facebook-flow.test.cjs
tests/ui/image-groups.test.cjs
tests/ui/image-preview-race.test.cjs
tests/ui/news-topics.test.cjs
tests/ui/original-ux.test.cjs
tests/ui/photos-quick-edit.test.cjs
tests/unit/feeds.test.cjs
tests/unit/image-form-scope.test.cjs
tests/unit/network-safety.test.cjs
tests/unit/proxy-reputation.test.cjs
tests/unit/proxy.test.cjs
```

</details>
