# BLEGO 1.4.1 — приёмка ТЗ №6

Эта ведомость сохраняет приёмку `b6afdf0`. Явное последующее требование показывать пароли и повторная проверка `1676e92` отражены отдельно: [password-display/REPORT.md](password-display/REPORT.md). Старые PASS не заменяют эту проверку.

Кандидат: `b6afdf04cb9d10996634279adc17273c3c2640b2`. PASS относится только к указанной проверке, не к универсальной готовности продукта. Старые результаты не перенесены автоматически.

| Пункт ТЗ | Проверка кандидата | Результат / доказательство |
|---|---|---|
| 1 | Нет прежних дополнительных полей Generator | PASS — generator GUI |
| 2 | Отдельная BIO: проживание, рождение, работодатель, должность, университет, школа, основной текст | PASS — generator-bio integration/GUI, ручная правка/копирование/перезапуск |
| 2 | Официальные учебные заведения и реальный город; ручная альтернатива | PASS — INSTITUTIONS.md,23 записи; не исчерпывающий каталог |
| 3 | Тематические emoji и точное копирование BIO | PASS — generator-bio integration/GUI |
| 4 | Независимые Quality/Trust0–100, неизвестный N/A | PASS — ui-v141 unit + proxy GUI/controlled transports; формула NETWORK.md |
| 5,18 | Friends import/confirm/dedupe/filter/open/copy/restart, неполные карточки | PASS — friends unit/integration/GUI |
| 6 | Settings только через шестерёнку | PASS — cleanup/app/settings/responsive GUI |
| 7 | News без Copy; тема/metadata/links/refresh сохранены | PASS — news-topics GUI и news integration; это не новый live RSS-прогон |
| 8 | English Network, без Ping/Copy/key/Sources/Technical Details | PASS — ui-v141 unit и proxy/UX GUI |
| 9 | Автоформат/кодировка, новая загрузка без старой схемы | PASS — classifier-v141 unit, classifier GUI; ручная коррекция доступна после импорта |
| 10–11 | Убраны LOCAL-плашки и декоративные статусы записей | PASS — cleanup GUI и снимки; реальные предупреждения сохранены |
| 12 | Нормализация/совпадение идентичности/login/challenge/429/отмена/8 статусов | PASS — facebook unit/integration/GUI на контролируемых ответах |
| 12 | Полная приёмка реальных публичных Facebook-профилей | BLOCKED — Linux HTTP FB_CONNECTION_REFUSED, Mac UNKNOWN; изолированный Linux Electron LOGIN_REQUIRED. NATIVE.md |
| 13 | BackupEmail отдельно, контекстные GEO/ФИО, точные ID/source/core7 | PASS — classifier-v141 и существующие classifier suites |
| 14 | Пояснения вокруг20 записей, сохранение слабых строк для проверки | PASS — classifier-v141 RED/GREEN; неизвестные значения не объявлены мусором |
| 15 | Полные cookies; exact copy; закрытие после успеха, сохранение при отказе | PASS — cleanup/cookie-cell/classifier-copy GUI; массовый отчёт не включает секреты |
| 16 | Сохранение всего/выбранной записи, свежий список, открытие/перезапуск | PASS — archive-v141 GUI, archive-recovery integration |
| 16 | Отказ записи/повтор/collision/исходник | PASS — archive recovery/boundary tests, исходные файлы не удалены |
| 17 | Mercator, реальные пиксели raster, маркеры/границы/До–После/resize/offline | PASS — map unit/integration/GUI и installed-снимки; live-провайдер отдельно |
| 17 | Живая географическая подложка | PASS Mac — реальный OSM-тайл и отрисовка в установленном приложении; native/public-services-native.json, screens/map-live-world.png. Linux production transport BLOCKED |
| 18 | Девять разделов на360/390/427/480/504/576/768/980/1280px | PASS — responsive GUI на Linux и фактические размеры установленного Mac-приложения; native/responsive-native.json |
| 19 | Сохранность оригиналов/SQLite/архивов/реестра/миграций | PASS — storage/addendum-upgrade/archive/generator/image integration |
| 20–21 | Полный набор без пропусков | PASS Linux и установленный Mac — 105 unit/119 integration/30 GUI, 0 skipped; NATIVE.md |
| 21.3 | 20 отдельных файлов и папка20 во вложенных каталогах | PASS Linux/Mac GUI: 20/20 в каждом сценарии; NATIVE.md. Завершение экспорта включает внутренний readback/пиксели/хэш оригинала |
| 21.3 | Исторический дополнительный GUI1000 | FAIL исторический, не повторялся и не объявлен исправленным |
| 21.4 | Сравнение1.4/1.4.1: launch/generate/import/archive/map/20photos/frames/memory | PASS измерения Linux/Mac; NATIVE.md. Есть замедления запуска/P95/панорамы, общее ускорение не подтверждено |
| 22 | Runtime/DMG/установка вне репозитория/ARM64/ZIP/SHA | PASS — NATIVE.md и native/SHA256SUMS-*.txt; runtime, установленный пакет и ZIP проверены |
| 22 | DeveloperID/нотариализация/Gatekeeper после скачивания | BLOCKED — сертификаты не предоставлены; проверка CI не заменяет пользовательскую установку с карантином |
| 23 | PR,SHA,изменённые файлы,причины,логи,скриншоты,ограничения | FINAL_REPORT.md / CHANGED_FILES.txt / NATIVE.md |
| 24–25 | Пользовательская финальная оценка и официальный выпуск | BLOCKED до оценки владельцем; PR не сливается, релиз не публикуется |
