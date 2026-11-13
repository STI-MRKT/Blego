# BLEGO 1.4 — ведомость ТЗ №5

PR: https://github.com/STI-MRKT/Blego/pull/6 · Ветка: codex/blego-v1-4-improvements · Без слияния.

База: `782c1b2c1b61703f81542eafb8d97a33fc3264ec`. Исходный визуальный эталон: `6e57eabfb5b51af4475b90686fa580b5ce57e9b0`. История A/D и прежние E01–E60 сохранены. Новые результаты ниже получены повторными проверками; старые PASS не перенесены автоматически.

Последнее уточнение владельца снижает обязательную приёмку Photos до **20 фотографий**. Большие ранее запущенные наборы — дополнительные свидетельства; существующая ёмкость приложения не уменьшается. См. [дополнение](../../specs/BLEGO_V14_PHOTOS_20_ACCEPTANCE_ADDENDUM.md).

PASS относится только к указанному сценарию/среде. Сетевые фикстуры не равны успешной проверке публичного сервиса. Автоматизированное изменение BrowserWindow bounds не равно ручному перетаскиванию границы окна на компьютере владельца.

| Требование | Статус и фактическая проверка |
|---|---|
| §1 аудит/сохранение | PASS: отдельная ветка; исходные 61/90/15 тестов сохранены и расширены. PR1/3/5 и main не изменены. |
| §2.1 карточка/полный профиль | PASS: раскрытие дополнительных полей убрано, значения/история/Copy full set сохранены; GUI/restart. |
| §2.2–2.3 имя/BIO | PASS: отдельные кнопки, точный native clipboard, понятный отказ; generator-v14 GUI. |
| §2.4 TECH | PASS: 25 обязательных +250 новых названий, отдельная brand_name стратегия, нормализованная уникальность; персональная проверка сохранена для MODEL/CRYPTO. |
| §2.5 пулы | PASS по ТЗ5: +256 локализованных пар для MODEL и CRYPTO; прежние значения сохранены. Старые минимумы ТЗ1.2 отдельно FAIL (dictionary-minima.json). |
| §2.6 email | PASS: новые нормализованные адреса @dayrep.com, постоянный уникальный суффикс; старые карточки не изменены. Существование почтового ящика не заявляется. |
| §2.7 BIO | PASS по объёму/локализации/дублям: +50 на каждый из7 языков×3 категории (1050), прежние30 сохранены. Редакторская оценка носителями языка BLOCKED. |
| Дополнение телефон | PASS:8 стран, значащие нули, код страны сохранённого профиля, без trunk-prefix; полный экранный/сохранённый номер и Full set; реальный clipboard/перезапуск. |
| Правка12 адрес | PASS: address→city→postalCode,24 сочетания, отдельные копии,1280/360; модель/семипольный экспорт не переставлены. |
| §3.1–3.6 разбор | PASS: синтетические A/B, смешанные разделители/JSON/многострочность, точные source spans, пустые/неизвестные поля, ID-конфликты и ручное назначение; без догадок о непрозрачных значениях. |
| §3.7–3.9 UI/cookie/export | PASS: маскирование/явное раскрытие, точный cookie конкретной строки после фильтра/сортировки/пагинации,11полей и прежние7полей экспорта. |
| §3.10 объёмы/ошибки | PASS:1/10/100/1000 записей, лимит50MiB, bounded worker/отмена/кодировки; classifier/importer suites. Конфиденциальные оригиналы A/B не предоставлены, их точное сравнение BLOCKED. |
| §4 вход/статусы/очередь | PASS controlled tests: ID/URL,8достоверных статусов, Retry-After/отмена/повтор одного/фильтр/сортировка. Нет BANNED/NOT_BANNED по публичному ID. |
| §4.3–4.5 внешние сведения | BLOCKED для живой доступности/Meta API:2 реальных анонимных запроса дали CONNECTION_REFUSED; разрешённых credentials нет. Полученное имя/аватар принимаются только с подтверждённой связью с target; локальные импортированные факты явно непроверенные. |
| §5 Friends | PASS импорт TXT/CSV/JSON preview→confirm, dedup, сохранение15 старых карточек/SQLite, поиск/фильтры/copy/explicit open/restart. Новые реальные ссылки BLOCKED до предоставления владельцем; вымышленные не добавлены. |
| §6 Photos | PASS для обязательного пакета20: выбор файлов, drop, вложенные папки, дедупликация, отмена и миниатюры. Сохранены защитные пределы1000файлов/10ГиБ,50МиБ/файл,40Мп; это не обещание успешного GUI1000 на Mac. |
| §7 GEO | PASS:8 реальных OSMграниц, лицензии/provenance, validatedlocalimport, CSPRNG sphericalarea rejection, holes/MultiPolygon/7decimals/recheck/unique. Только явный Generate/Regenerate; altitudeKeep; no radius. |
| §7.7 движение | PASS: actualpointerdrag, boundary/duplicate/revision validation; single/multi dirty draft export/readback сохраняют даты и GPS остальных фото. |
| §8 карта | PASS: локальный Canvas/GeoJSON, До/После/нетGPS, thumbnail/selection/clusters/zoom/pan/1000markers/narrowstate, без внешних запросов. Без уличной подложки; выбор обоснован MAP_DESIGN.md. Необязательная анимация через земной шар не добавлена. |
| §9 экспорт | PASS: реальные JPEG/PNG/WebP write/readback, originals/pixels/alpha/ICC/orientation, safeexclusivepublish/relativefolders/collision/cancel/retry/permission/ENOSPC tests. Обязательные наборы1/10/20 — малые синтетические, отдельно реальная16.176Мп фотография в3форматах. Ранее выполненные100/500/1000engine-наборы дополнительные. |
| §10 адаптивность | PASS Linux actualbounds:360/390/427/480/504/576/768/980/1280×9разделов, compact/fullmenu/footer/localoverflow, cookie/generation/form/export сохраняются. Mac evidence отдельно. Исходные6CSS, icons.js и графические ресурсы byte-identical оригиналу; экранное сравнение отдельно от проверки хешей. |
| §11 Settings | PASS:6 русских основных подписей/пояснения, eachpermissiontrue/false/true с сравнением всей модели/перезапуском. |
| §12–13 архитектура/безопасность | PASS проверенных сценариев: существующие SQLite/workers/metadata/ZIP/clipboard, без секретов в Git/логах, guardedIPC/URLs/paths, rate/size/cancel, backup+migration. Это не заявление об отсутствии всех возможных уязвимостей. |
| Network regression | PASS реальные локальные HTTP/HTTPS/SOCKS5 transports/auth/TLS/timeout/SSRF fixtures и Trust validation. BLOCKED внешние контрольные прокси и providerAPI без данных/ключей владельца. |
| News regression | PASS realGUI:Fashion32,AI20,Crypto40,Finance32,Technology40 карточек; unique32/20/59/32/65; источники3/3,2/3,3/3,3/3,5/5. ОшибкаAIисточника не скрыта; timestamps/URLs в news-ui-live-linux.json. |
| Дополнительный GUI1000 | FAIL: прежний Mac-прогон прочитал1000файлов, затем превысил30с ожидания кнопки экспорта после preview. Полная причина задержки большого пакета не установлена; не переносить PASS engine1000 наGUI. Владелец снизил обязательный объём до20до завершения этого прогона. См. supplemental/NATIVE_STRESS.md. |
| §14.2–14.3 QA ARM64 | PASS: macOS15.8.2 / Apple M1 Virtual;90unit/116integration/27installedGUI,20files+20folder,DMG/ZIP/CRC/SHA256. [Полный native-отчёт](NATIVE.md). |
| §14 Apple signing | BLOCKED Developer ID/notarization и Gatekeeper clean-download acceptance; сертификаты не предоставлены, защита не отключается. |
| §16 производительность | PASS фактических измерений; окончательное заключение об отсутствии ухудшения воспринимаемой скорости BLOCKED до оценки на Mac владельца/сопоставимого повторного замера. Запуск/генерация в малой source-vs-installed выборке медленнее; числа и P2 открыто приведены в NATIVE.md. |
| §17 независимое ревью | PASS:4 замечания P2+multi-selection followup исправлены, independentrecheck без оставшихся findings; REVIEW.md. |
| §19–20 приёмка | Подготовка QA не заменяет совместную пользовательскую оценку. Не объявляется безусловная готовность всех платформ/внешних источников/подписанного выпуска. |

## Ограничения

- P1: неподписанная/ненотариализованная QA-сборка может блокироваться Gatekeeper, включая сообщение «повреждено». Минимум macOS13 заявлен конфигурацией, отдельно не испытан; физический M1 владельца не проверен.
- P1: live Facebook/authorized Meta API и внешние прокси/providercredentials недоступны; controlledtests перечислены отдельно.
- P2: старые минимумы имён/фамилий/улиц/независимыхpostal links остаются FAIL. Названия конечны, исчерпание сообщается явно; TECH не выдаёт числовой шум за новые бренды.
- P2:8 городов локального каталога; GB=CityofLondon, не весь GreaterLondon. Границы могут включать воду/сельские территории; dateline/polar unsupported с явной ошибкой. Нет уличныхтайлов, импорт дополнительных лицензированных границ явный.
- P2: запуск/генерация в трёх native UI-замерах медленнее1.3; причина не установлена, сравнение source/installed и малая выборка ограничивают вывод. Числа в NATIVE.md; отсутствие регрессии не заявляется.
- P2: дополнительный Mac GUI1000 не завершён (тайм-аут preview); обязательная приёмка ограничена20фото.
- P2: Windows/x64Mac native acceptance и проверка обновления на реальных данных владельца не выполнены. Временные upgrade fixtures не равны всей пользовательской истории.
- P2: конфиденциальные оригиналы TXT отсутствуют; синтетические аналоги соответствуют описанным форматам. Неоднозначные значения остаются неизвестными/пустыми и доступны для ручного назначения.
- P2: редакторская проверка BIO носителями и новые реальные Friends ссылки ожидаются; не подменены фиктивными данными.
- Замеры памяти относятся к parentNode/RSS, не всей process tree. 1000 малых изображений не обещают ту же скорость на1000×40MP. Облачный виртуальный дисплей не подтверждает субъективную плавность на Mac пользователя.

## Команды Linux

`npm ci`; `npm run verify` (включает `npm run lint`, `npm run test:unit`, `npm run test:integration`); `BLEGO_HEADLESS=1 BLEGO_CAPTURE=/tmp/blego-v14-reviewed-gui npm run test:ui`. Результат: lintPASS,90 unit/116 integration/27 GUI,0 skipped. Логи: [verify](linux/verify.txt), [GUI](linux/gui.txt).

Профильные команды и RED/GREEN по этапам: [PROGRESS.md](PROGRESS.md). Живые новости: `node scripts/check-news-live.cjs` и `node scripts/check-news-ui-live.cjs <report>`. Старые словарные минимумы: `node scripts/check-dictionary-minima.cjs` → exit1, сохранён FAIL. Методика нагрузок и сравнений: [PERFORMANCE_METHOD.md](PERFORMANCE_METHOD.md).

Последний обязательный Photos-профиль Linux: [1.3](linux/photos20-baseline13.json), [1.4](linux/photos20-candidate.json), [папка/GEO/readback](linux/photos20-folder.json), [GUI20](linux/photos20-gui.txt).20/20 файлов записано;10.099с total,3.917с read,51мс max renderer gap на малых PNG.

Итоговая QA-сборка20: **9645632c9d3a047c6012521695331f6db19f6e6b**, [workflow](https://github.com/STI-MRKT/Blego/actions/runs/43409013460), [native и артефакты](NATIVE.md), [снимки](VISUAL.md), [изменённые файлы](CHANGED_FILES.txt). Это кандидат для совместной оценки с перечисленными ограничениями, не официальный релиз.
