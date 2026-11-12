# BLEGO v1.2 — фактическая ведомость E01–E60

**49 PASS, 2 FAIL, 9 BLOCKED. Полная готовность продукта/нативного выпуска не заявлена.**

Код приложения и Linux-пакета: **9f5ced97b79970f6204b9cdda26ab28ee24c6168**. Последующий коммит добавляет эту приёмку и проверочные тесты; байты приложения в пакете совпадают с checkout. Историческая колонка E01–E32 сохранена как история aeb8c23; новая колонка основана на повторных запусках, не на переносе прежних PASS.

Все локальные PASS относятся к Codex Cloud: Debian 13.6, Linux 6.18.57 x86_64; Node 24.22.1, npm 11.9.0, Electron 45.3.1, builder 26.18.0, Sharp 0.35.5, ExifTool 13.63, embedded Perl 5.40.1. Дата: 2026-11-12. **42 unit + 71 integration + 3 source GUI + 3 installed GUI PASS.**

Команды, SHA-256/размеры артефактов, метрики и границы: [UNIFIED_12_RELEASE.md](UNIFIED_12_RELEASE.md). Доказательства ниже лежат в [evidence12](evidence12/); индекс — [index.json](evidence12/index.json). Нативные блокеры и отсутствие FB-корпуса не заменены фикстурами.

## Исторические E01–E32 и повторная приёмка

| ID | История aeb8c23 | Предмет проверки | Новый кандидат | Доказательство / ограничение |
|---|---|---|---|---|
| E01 | PASS | Сохранность A/D-истории, владельцев БД/реестра/clipboard и переноса репозитория | PASS | Git: A0–A7/D0–D7 сохранены; baseline aeb8c23, ветка codex/blego-local-v1. Общие владельцы служб прежние. |
| E02 | FAIL | Объём и независимая проверка словарей/географии по восьми странам | FAIL | FAIL: data/dictionary-minima-12.json; имена/фамилии/улицы ниже цели, GB 6 мест, независимых postal links 0. |
| E03 | PASS | 24 страна × тип; обязательные контакты и тематическое содержание | PASS | verify.txt: generator-diversity/female-names, 24 сочетания страна × тип; обязательные контакты. |
| E04 | PASS | Unicode, формы имён, транслитерация, строковые ID/индексы | PASS | verify.txt: Unicode, transliteration, importer/JSON precision, строковые индексы; source-ui.txt. |
| E05 | PASS | 10 000 выдач на тестовом диапазоне и сохранение уникальности | PASS | verify.txt: generator-registry, фактические 10 000 тестовых выдач и перезапуск. |
| E06 | PASS | Честное исчерпание малых/строгих пулов до расходования контактов | PASS | verify.txt: реальные малые/строгие пулы, расширенный postal pool; контакты не тратятся после исчерпания. |
| E07 | PASS | Preview/apply/cancel пакета данных и сохранность активного набора | PASS | verify.txt + source-ui.txt: catalog package preview/apply/cancel, старые issued остаются. |
| E08 | PASS | Точная нормализация длинного Facebook ID и форм ссылки | PASS | verify.txt: facebook normalize; длинные ID без округления. |
| E09 | PASS | Ограничение хостов/редиректов/private IP и недоверенного ввода | PASS | verify.txt: facebook transport/normalize, redirect/DNS/private-address guards; тестовый transport. |
| E10 | PASS | Один og:title/HTTP 200/login не становится бан-вердиктом | PASS | verify.txt: public-response fixtures; один og:title/login/200 не доказывает бан. |
| E11 | PASS | Раздельные 403/404/429/challenge/тайм-аут; бан неизвестен | PASS | verify.txt: HTTP/status/challenge/deadline fixtures; banAssessment=unknown. |
| E12 | NOT_RUN | Актуальный реальный, а не только синтетический корпус Facebook | BLOCKED | BLOCKED: FACEBOOK_LIVE_12.md; 2 штатных запроса дали network_error до HTTP-страницы, реального корпуса нет. |
| E13 | PASS | Отмена/новый runId/устаревшие ответы FB | PASS | verify.txt: cancellation, runId, stale events; source-ui.txt. |
| E14 | PASS | Ручные заметки владельца отдельно от автоматической диагностики | PASS | verify.txt: owner notes отдельно; aeb8c23 upgrade и GUI. |
| E15 | PASS | Реальная запись/удаление/read-back JPEG/PNG/WebP | PASS | verify.txt + runtime-linux.json: реальная запись/удаление/readback JPEG/PNG/WebP; installed-ui.txt: PNG экспорт. |
| E16 | PASS | Пустые/смешанные/Unicode значения, keep/set/remove, даты и GPS | PASS | verify.txt: empty/mixed/Unicode, keep/set/remove, ISO/fraction/date/offset/GPS. |
| E17 | PASS | Оригинал, encoded payload, RGBA, Orientation, ICC, прозрачность | PASS | verify.txt: исходный SHA, protected encoded payload, decoded RGBA, Orientation/ICC/alpha. |
| E18 | PASS | Удаление известных дубликатов GPS/личных тегов без обещания анонимности | PASS | verify.txt: metadata-privacy-regression, известные дубли GPS/owner/serial; не гарантия анонимности. |
| E19 | PASS | Обнаруженная provenance/анимация/повреждение/неподдерживаемый формат | PASS | verify.txt: повреждение, animation, detected C2PA/provenance, extension mismatch; не весь мировой корпус. |
| E20 | PASS | Безопасные argv, имена, отключённая конфигурация движка | PASS | verify.txt + runtime-linux.json: фиксированные argv, config disabled, PATH пуст, небезопасный ввод отклонён. |
| E21 | PASS | Отмена/source changed/read-back mismatch/отказы записи | PASS | verify.txt + resources.json: отмена/source change/verification faults; настоящие копии не портят оригинал. |
| E22 | PASS | 100 файлов: исторически только малые PNG; новые границы проверить отдельно | PASS | 100-ui.json: 100/100 read/completed/output; resources.json и mixed-ui.json дополняют малые PNG. |
| E23 | PASS | Единое копирование значений/карточек/таблиц/порядка | PASS | verify.txt + source-ui.txt + installed-ui.txt: общий serializer/clipboard для всех рабочих разделов. |
| E24 | PASS | Выделение/фильтры/пагинация из модели, не только DOM | PASS | source-ui.txt: 51 строка, выделение через страницы, фильтр; группа копируется из полной модели. |
| E25 | PASS | Табы/кавычки/переносы/формулы/длинные ID в форматах копирования | PASS | verify.txt + source-ui.txt: JSON/TSV, переводы строк, кавычки, формулы, длинные ID. |
| E26 | PASS | Отказ/mismatch clipboard, граница 10 МиБ без обрезания | PASS | verify.txt: actual clipboard refusal/readback mismatch, ровно 10 MiB и превышение. |
| E27 | PASS | Безопасный массовый отчёт, личные поля по явному выбору | PASS | verify.txt: report/photo allowlists, personal opt-in, без путей/credentials по умолчанию. |
| E28 | PASS | Клавиатура/фокус/последовательное копирование | PASS | source-ui.txt + installed-ui.txt: фокус, native clipboard, последовательное копирование; Linux keyboard. |
| E29 | PASS | Буфер картинки отдельно от файла с метаданными | PASS | source-ui.txt + installed-ui.txt: реальный image clipboard передаёт пиксели отдельно от metadata-файла. |
| E30 | BLOCKED | Установленные macOS arm64/x64 и Windows x64, подпись/нотариализация отдельно | BLOCKED | BLOCKED: только Linux. macOS arm64/x64 и Windows x64 не установлены/не запущены; подпись не проверена. |
| E31 | PASS | Миграция A7 с сохранением архивов/контактов/настроек/карточек | PASS | verify.txt: база реально создана A7 211d2a2, затем копия открыта новым кодом; ZIP/issued/settings/card сохранены. |
| E32 | PASS | Общая регрессия существующих A/D-функций | PASS | verify.txt: 42 unit + 71 integration; source-ui.txt/installed-ui.txt: по 3 GUI PASS. |

Исторический итог: 29 PASS, 1 FAIL, 1 NOT_RUN, 1 BLOCKED. Это не «29 новых тестов уже пройдено». Особенно E22 относится к малым PNG, E30 — к недоступным целевым платформам.

## Новые E33–E60

| ID | Этап | Требования | Проверка и условие успеха | Статус | Доказательство |
|---|---|---|---|---|---|
| E33 | D8/D9 | M-01–M-04 | Новые значения только после ручного ввода, выбранного шаблона/образца; страна/тип/IP/часы ОС ничего не подставляют. | PASS | workspace tests + image-groups GUI: manual/preset/reference, пустые новые значения, никакой генерации метаданных. |
| E34 | D9 | M-05–M-06 | Создать/переименовать/удалить группу, переместить/снять файл; исходные байты и файлы на диске не изменены. | PASS | image-groups tests/GUI: CRUD, перемещение, снятие, canonical dedup; исходники сохраняются. |
| E35 | D8/D9 | M-04,M-07 | Inherit применяет правило группы, явный Keep его отменяет; смешанные и отсутствующие значения не становятся пустым Set. | PASS | image-workspace + GUI: inherit/explicit Keep и разные overrides; повторное выделение не затирает изменения. |
| E36 | D10 | M-09,M-24 | 100 файлов/50 МиБ/512 МиБ/40 МП и два worker действуют на все группы, включая одновременные команды; превышение видно. | PASS | verify.txt + resources.json: общие лимиты и 2 workers; references и concurrent registration учтены. |
| E37 | D10 | M-19 | Изменение формы, выделения, шаблона, исходника или папки после предпросмотра блокирует старый план; требуется новый просмотр. | PASS | group-export + GUI: ревизия/форма/выделение, source/ref hash, заменённая папка → PLAN_STALE. |
| E38 | D10 | M-08,M-19,M-22 | Один запуск всех групп применяет эффективные операции нужного файла; двойной клик/запаздывание не создают два успешных результата. | PASS | group-export: per-file immutable operations, атомарный lock, повторный run/plan без второй записи. |
| E39 | D9/D10 | U-03,M-01–M-03 | При отключённой сети ручной ввод, шаблон, выбранный образец, предпросмотр/экспорт работают без внешних запросов. | PASS | offline GUI + local group/reference tests; сети не требуется, native-dialog доступ остаётся явным. |
| E40 | D9 | M-11–M-13 | Ручные ISO/диафрагма/выдержка/фокусное, дата/offset/GPS проходят реальную запись/read-back; неподдерживаемое явно отклонено. | PASS | camera-fields/metadata-write + runtime probe: реальные 3 формата, fractions/date/GPS; multi-ISO Keep сохранён. |
| E41 | D9 | M-16–M-18 | Выбраны два поля образца — перенесены только они; отсутствующее поле не очищает назначение, подмена образца обнаружена. | PASS | image-reference: только выбранные доступные поля, отсутствующее пропускается, source change обнаружен. |
| E42 | D9 | M-17,K-03 | GPS/автор/дата выбираются явно; identifiers/Orientation/ICC не переносятся; массовый отчёт скрывает персональные значения по умолчанию. | PASS | reference allowlist + copy policy: персональные поля вручную; identifiers/Orientation/ICC не импортируются. |
| E43 | D9 | M-14–M-15,S-04 | Создание/дубликат/изменение/удаление/JSON-импорт шаблона; старые шаблоны сохранены, повреждённый импорт не меняет действующие. | PASS | image-groups + metadata-write: preset CRUD/import/export, старый v1, malformed import atomic; GUI + upgrade. |
| E44 | D9 | M-10 | После явного сохранения и перезапуска настройки групп восстановлены; токены доступа обновлены, запись/чтение файлов не стартуют скрыто. | PASS | workspace-store + GUI: явный Save сохраняет показанные group drafts, рестарт без старых разрешений; per-file overrides только сессионные. |
| E45 | D10 | M-25 | Повторить только выбранные failed/cancelled: completed не запускаются второй раз; изменённый оригинал/правила требуют нового плана. | PASS | group-export + resources.json: выбранные failed/cancelled, новый просмотр, re-read изменённого источника, старая история сохранена. |
| E46 | D10 | M-24 | Отмена группы/всех останавливает нужные задачи, сохраняет completed; старые события не портят новый runId. | PASS | group-export/GUI + resources.json: group/all cancel, completed остаются, stale run не отменяет новый. |
| E47 | D10 | M-21–M-22,A-07 | Коллизии имён, кириллица, пробелы, отказ ФС/hard-link: без перезаписи оригинала/старого результата и ложного completed. | PASS | export-boundaries.txt: реальная link-коллизия/Unicode и chmod-denial Linux; controlled unsupported-link preflight; без перезаписи. |
| E48 | D10 | M-26–M-27,K-01–K-06 | Копирование группы/фильтра/всего отчёта имеет верный охват; сохраняет порядок, Unicode, safe/raw, редактируемый фокус и лимит 10 МиБ. | PASS | image-group-copy + GUI/copy suite: отдельный источник текущей группы, фильтр/все, порядок/форматы/focus/10 MiB. |
| E49 | D10 | M-28 | 100 малых плюс отдельные большие/граничные изображения и суммарный вход: точные метрики, контролируемая память, отзывчивость и отмена. | PASS | resources.json + 100-ui.json + mixed-ui.json: 40 MP, 50 MiB, 512 MiB, over limits, RSS/cancel/GUI metrics; точный синтетический объём в RELEASE. |
| E50 | D8/D14 | S-04,U-04 | Миграция временной базы исходным aeb8c23 и A7: ZIP SHA, registry, старые пресеты, настройки, карточки и FB-заметки сохранены. | PASS | verify.txt: реальные базы 211d2a2 и aeb8c23; ZIP SHA/registry/lastCard/settings, v1 presets и FB notes; migration rollback tests. |
| E51 | D11 | G-04–G-06 | Фактические minima всех восьми стран + происхождение/лицензии + подтверждённые пары; дефицит не превращается в PASS. | FAIL | FAIL: data/dictionary-minima-12.json и DATA_SOURCES.md. Проверка minima фактически завершается exit 1; нет фиктивных PASS. |
| E52 | D11 | G-08–G-10 | Новый пакет словарей не освобождает выданные контакты; ограничивающее поле и действительная ёмкость не заменены числом комбинаций имён. | PASS | catalog/registry/upgrade tests: новый источник не освобождает contacts; реальные ёмкости и limiting fields. |
| E53 | D12 | F-01–F-04 | Реальные актуальные обезличенные FB-наблюдения отделены от синтетики; login/429 не доказывают бан и не закрывают все разновидности профилей. | BLOCKED | BLOCKED для реальных HTTP-наблюдений: FACEBOOK_LIVE_12.md. Только сетевые ошибки; фикстуры отдельно. |
| E54 | D13 | OS-02–OS-04 | darwin-arm64: встроенный интерпретатор/ExifTool/Sharp/libvips реально работают; checksum/arch/зависимости, отсутствие PATH-fallback. | BLOCKED | BLOCKED: нет darwin-arm64 среды/встроенного runtime; Linux invocation отвергнут TARGET_HOST_MISMATCH. |
| E55 | D13 | OS-02–OS-04 | darwin-x64: независимая проверка того же состава; эмуляция отмечена отдельно, не выдаётся за физический Intel. | BLOCKED | BLOCKED: нет darwin-x64 среды/встроенного runtime; Linux не заменяет Intel Mac. |
| E56 | D13 | OS-05–OS-06 | Mac arm64: установка и запуск из пакета, офлайн, clipboard, группы, экспорт/read-back, диалоги, Unicode, перезапуск/обновление. | BLOCKED | BLOCKED: нет QA DMG/установленного Mac arm64; не запускалось. |
| E57 | D13 | OS-05–OS-06 | Mac x64: те же installed-сценарии на реально описанной среде; проверенные версии ОС и условия перечислены. | BLOCKED | BLOCKED: нет QA DMG/установленного Mac x64; не запускалось. |
| E58 | D13 | OS-07 | При разрешённых полномочиях проверены подписи вложенных компонентов и нотариализация; без них BLOCKED, никакого обхода защиты. | BLOCKED | BLOCKED: нет signing/notarization среды/сертификатов/полномочий; обход Gatekeeper не выполнялся. |
| E59 | D13 | OS-08 | Windows x64: встроенный exe/native libraries и установленное приложение реально проверены; статус подписи отдельный. | BLOCKED | BLOCKED: нет native Windows x64 runtime/установки; Authenticode не проверен. |
| E60 | D14 | U-06,раздел 12 | Новый SHA, полная регрессия и ведомость E01–E60, сборочные доказательства/ограничения; проект не назван полностью готовым при открытых обязательных шлюзах. | PASS | Новый application SHA, фактическая регрессия/QA Linux artifact, все E01–E60 и ограничения зафиксированы; это не полный release PASS. |

## Сводка платформ

| Платформа | Runtime | QA-пакет / установленный запуск | Подпись |
|---|---|---|---|
| Debian 13.6 / Linux 6.18.57 x64 | PASS, PATH пуст | PASS tar.gz; распакован вне checkout, 3 GUI PASS | Не заявлена; Apple notarization неприменима |
| macOS arm64 | BLOCKED | BLOCKED / не запускалось | BLOCKED |
| macOS x64 | BLOCKED | BLOCKED / не запускалось | BLOCKED |
| Windows x64 | BLOCKED | BLOCKED / не запускалось | BLOCKED |

Сценарии OS-диалогов в GUI используют управляемые ответы. Это не проверка реальных Mac/Windows permission-denial, оконного менеджера или подписей. macOS 13.0 остаётся заявленным, но не проверенным минимумом.

## Оставшиеся ограничения

- E02/E51: дефициты имён/фамилий/улиц, GB localities и независимой проверки индексов; точные числа в JSON. Семь стран получили по 500 исходных GeoNames-пар, это не второй независимый источник.
- E12/E53: штатный клиент не получил HTTP-страниц; реальный FB corpus заблокирован. Ban assessment всегда unknown; owner notes отдельно.
- E30/E54–E59: нет соответствующих нативных сред/runtime/поставок и signing credentials. Шлюзы не сняты.
- Предметная классификация DEFERRED: правила заказчика не получены, rules_pending не готовность; пропуски импорта остаются пустыми.
- Членство файлов/персональные overrides остаются в сессии. Явно сохранённые group rules/presets восстанавливаются; доступ к файлам и эталонам надо выдать заново.
- Точные сценарии ресурсов синтетические, не все камеры/ICC/C2PA/entropy combinations; потеря питания физически не проверялась. Новые живые proxy/news источники и ключи не добавлялись.
- Нет гарантий мирового владения/уникальности контактов или анонимности изображений. Не было публикации приложения, покупки сервисов, изменения main или слияния PR.
