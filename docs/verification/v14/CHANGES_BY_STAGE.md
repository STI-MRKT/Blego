# BLEGO1.4: изменения по этапам

База782c1b2 сохранена. Ветка: [codex/blego-v1-4-improvements](https://github.com/STI-MRKT/Blego/tree/codex/blego-v1-4-improvements). Все существующие PR1/3/5 остаются без изменений; слияния и официального релиза нет.

| Коммит | Этап и результат |
|---|---|
| 9e3df81 | Аудит, отдельная ветка, исходная регрессия61unit/90integration/15GUI |
| 28755a2 | Classifier: смешанный TXT, точные исходные spans/cookie, консервативное распознавание, конфликты/ручное назначение, прежний7-field export |
| c0882ee | GEO:8реальных OSM-границ, лицензии, локальный импорт, Polygon/MultiPolygon/holes, bounded uniform sampling |
| 93e4f06 | Photos: явная генерация GEO на файл, стабильный preview/export, сохранение altitudeKeep |
| 39ed4bb | Facebook:8достоверных состояний, причины/источник/время, очередь/retry, локальные непроверенные факты отдельно |
| d0208b2 | Сопоставление объединённого ТЗ с выполненным, без отката или дублирования служб |
| 3a0e93d / 147ad22 | Generator:275TECH-названий, +256пар MODEL и CRYPTO,1050BIO, @dayrep.com, registry/migration backup, отдельные Name/BIO copies |
| 6950a68 | Photos folders: безопасное рекурсивное сканирование, inode dedup, относительная структура, существующий export/readback |
| f0844de | Offline Canvas-карта: До/После, выбор/миниатюра, zoom/pan/clusters, проверяемое перемещение внутри города |
| a858b15 | Friends: локальный импорт TXT/CSV/JSON preview→confirm, сохранение seed pool, поиск/фильтры/copy/open/restart |
| 2096418 | Responsive: native min360, компактное/полное меню, footer,9ширин×9разделов, формы/операции без reset |
| 0a5ee16 | Телефон: только национальные цифры у соседней кнопки; полный stored/display/Full set. Адрес→город→индекс,24preset |
| 8025a8b | Settings: русские основные подписи/пояснения, независимые переключатели и перезапуск |
| 050b34a | Нативная QA-поставка1.4.0, runtime gate, сравнение1.3/оригинала, установочный ZIP |
| 96b81f4 | Исправления независимого ревью: cookie ownership, multipart density, Friends aliases, dirty/multi GPS drafts; canonical Mac collision test |
| 9ebb324 | Старый ресурсный QA приведён к текущему10GiB budget без удаления40MP/50MiB/512MiB write/cancel/retry checks |
| 9645632 | Уточнение владельца: обязательная приёмка Photos20; общий baseline/candidate harness, source/native20файлов и20folder; successful Mac build |

Каждый функциональный этап имеет профильные и общие проверки в [PROGRESS.md](PROGRESS.md). Итог: [ACCEPTANCE.md](ACCEPTANCE.md), [E01–E60](E01-E60.md), [native/installer](NATIVE.md), [изменённые файлы](CHANGED_FILES.txt). Финальная документация не изменяет байты входов приложения относительно собранного9645632.
