# BLEGO 1.4.1 — фактическая проверка macOS ARM64

Код сборки: **b6afdf04cb9d10996634279adc17273c3c2640b2**. [Run 43441018681](https://github.com/STI-MRKT/Blego/actions/runs/43441018681) — SUCCESS, 13 ноября 2026. Последующий коммит добавляет отчёты и снимки; продуктовый код и пакет не меняются.

Среда: macOS **15.8.2**, build **24H232**, Darwin 24.6.0, ARM64, **Apple M1 (Virtual), VirtualMac2,1**; Node 24.22.1, Electron 45.3.1. Это облачная Mac VM, не компьютер владельца. Полный вывод: [macOS-env.txt](native/macOS-env.txt).

## Выполненные проверки

| Проверка / команда | Фактический результат |
|---|---|
| `npm run verify` | lint PASS; **105 unit + 119 integration PASS**, 0 failed/skipped; [лог](native/verification-native.txt) |
| `node scripts/check-metadata-native.cjs --target darwin-arm64 --root build/metadata-runtime/darwin-arm64 --report release/native-darwin-arm64.json` | PASS до упаковки; Perl 5.40.1/ExifTool в комплекте, пустой PATH, JPEG/PNG/WebP read/write/readback, сохранение оригиналов и пикселей; [JSON](native/native-darwin-arm64.json) |
| `npm run dist:mac -- --arm64` | PASS, создан DMG. Проверка runtime перед упаковкой не отключена |
| `hdiutil attach -readonly`, `ditto` в `$RUNNER_TEMP/BLEGO-qa.app`; standalone dependency probe через установленный Electron | PASS, запуск вне checkout, разрешение и загрузка production-зависимостей из app.asar |
| `node scripts/check-installed-app.cjs --executable "$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" --report release/installed-darwin-arm64.json` | **30 GUI PASS**, 0 failed/skipped, 281.268 с; [JSON](native/installed-darwin-arm64.json), [лог](native/installed-darwin-arm64.json.txt) |
| `BLEGO_EXECUTABLE=… node scripts/check-metadata-ui-batch.cjs` | **20/20** отдельных файлов прочитаны и экспортированы; 11.856 с, max event-loop gap 175 мс; [лог](native/metadata-ui-batch-darwin.txt) |
| То же с `BLEGO_GUI_FOLDER_COUNT=20` | **20/20** файлов из вложенных папок; 10.718 с, max event-loop gap 159 мс; [лог](native/metadata-ui-folder20-darwin.txt) |
| `BLEGO_FOLDER_LOAD=1 node scripts/check-metadata-load.cjs release/metadata-load-darwin.json` | PASS: 1/10/20; отдельный readback дат/GPS, хэши оригиналов, пиксели/альфа; [JSON](native/metadata-load-darwin.json) |
| `node scripts/check-real-photo.cjs …` для 1.4 и кандидата | PASS: реальная лицензированная панорама в JPEG/PNG/WebP, 6000×2696, исходные хэши/пиксели/даты/GPS; [кандидат](native/real-photo-candidate.json), [1.4](native/real-photo-baseline14.json) |
| Реальное изменение окна | PASS: 360/390/427/480/504/576/768/980/1280 px, девять разделов, без потери состояния и глобального переполнения; [JSON](native/responsive-native.json) |
| `sha256sum -c SHA256SUMS-mac.txt`, `sha256sum -c SHA256SUMS-zip.txt`, `unzip -t …install.zip` после скачивания в Linux | PASS: оба хэша совпали, ZIP содержит DMG, SHA256SUMS-mac.txt, INSTALL-RU.txt, повреждений нет |

Диалоги выбора файлов используют контролируемые ответы; clipboard — реальный Electron clipboard API. Это не проверка всех системных диалогов/отказов macOS. Пакеты 20 файлов используют небольшие синтетические изображения 12×8; отдельно проверена реальная панорама 16.2 MP в трёх форматах. Это не стресс-тест 20 максимальных 40 MP изображений. Производственный экспорт перед успешным завершением проверяет readback, защищённый payload, RGBA/ориентацию/профиль и хэш оригинала; отдельный нагрузочный сценарий также независимо перечитывает копии. Системное время создания файла не выдается за изменённые EXIF/XMP-теги.

## Сравнение производительности

`node scripts/check-ux-performance.cjs --original "$RUNNER_TEMP/blego-original-reference" --baseline "$RUNNER_TEMP/blego-baseline-reference" --baseline-executable "$RUNNER_TEMP/BLEGO-baseline14.app/Contents/MacOS/BLEGO" --executable "$RUNNER_TEMP/BLEGO-qa.app/Contents/MacOS/BLEGO" --report release/ux-performance-darwin.json`

Один Mac runner, три изолированных запуска на версию, одинаковые синтетические данные; 1.4 и 1.4.1 упакованы. Перед действиями экскурсия закрывается через её кнопку. [Полный JSON, включая процессы и память](native/ux-performance-darwin.json). Медианы трёх наблюдений:

| Метрика, мс | 1.4 | 1.4.1 |
|---|---:|---:|
| Запуск до кнопки генерации | 1229 | 1360 |
| Генерация | 183 | 177 |
| Импорт 1000 строк | 310 | 281 |
| Сохранение/открытие архива | 920 | 678 |
| Загрузка фото и маркера | 362 | 317 |
| Интервал кадров, медиана | 16.7 | 16.7 |
| P95 интервала кадров | 20.9 | 29.3 |
| Максимальный интервал, медиана выборок | 68.0 | 50.8 |

Нативный ручной сценарий 20 изображений: 7439→6939 мс; реальная панорама/три формата: 8217→9051 мс, peak parent Node RSS 762413056→776896512 байт. Это одиночные прогоны, RSS не включает все дочерние процессы. Данные и метод доступны в `metadata-load-*-manual.json`, `metadata-load-baseline14.json` и `real-photo-*.json`.

**Общего ускорения не доказано.** Запуск +131 мс, P95 кадров +8.4 мс, панорама +834 мс; генерация/импорт/архив/карта быстрее в этих наблюдениях. Три запуска общей VM и один фото-прогон не позволяют отделить влияние кода от нагрузки хоста; причинная атрибуция не установлена. Эти замечания P2 остаются для повторного замера/пользовательской оценки на физическом M1. Не объявляем прежний дополнительный GUI1000 исправленным: исторический FAIL сохранён, повторно не запускался.

## Реальные публичные сервисы

[public-services-native.json](native/public-services-native.json):

- **OSM PASS**: один настоящий мировой тайл `https://tile.openstreetmap.org/0/0/0.png`, через production transport/проверенный кэш. В установленном приложении подтверждены `dataset.tiles > 0` и изменение более 1000 пикселей; [фактический снимок](screens/map-live-world.png). Это не массовое скачивание тайлов и не гарантия доступности провайдера всегда. Офлайн-точки/границы и контролируемая навигация проходят отдельно.
- **Facebook BLOCKED**: анонимная Meta-страница на Mac дала `UNKNOWN / INSUFFICIENT_EVIDENCE` за 890 мс. Не подтверждены контент именно профиля и полная матрица реальных публичных целей. На Linux production HTTP дал FB_CONNECTION_REFUSED.
- Дополнительное исследование изолированного Electron на Linux: эфемерная сессия, sandbox, без импортированных cookies/авторизации, без permissions/downloads/popups, только Facebook/fbcdn HTTPS. Страница загрузилась с HTTP200 и заголовком «Meta | Facebook», но с формой входа, og:type `video.other`, без JSON-LD. Существующий инспектор дал **LOGIN_REQUIRED**, а не PROFILE_VISIBLE. [Наблюдение](linux/facebook-browser.json), [точный пробный код](linux/facebook-browser-probe.txt). Браузерная загрузка не обеспечила подтверждённый публичный профиль; автоматический fallback в продукт не добавлен. Его Mac-вариант не проверен, положительная реальная приёмка остаётся BLOCKED. Ограничения не обходились.
- Пользовательские контрольные прокси/платные ключи репутации не предоставлены: их реальные проверки BLOCKED. Контролируемые HTTP/HTTPS/SOCKS5/SOCKS5h и независимость Quality/Trust проверены; N/A не заменён положительной оценкой.

## Пакет для оценки

[GitHub QA artifact](https://github.com/STI-MRKT/Blego/actions/runs/43441018681/artifacts/14046591075), срок хранения до **18 ноября 2026, 14:27 UTC**. Внешний ZIP артефакта содержит и отчёты; установочный файл внутри — **BLEGO-1.4.1-macOS-ARM64-install.zip** (около 144 MiB). Копия для передачи сохранена в `/workspace/BLEGO-1.4.1-macOS-ARM64-install.zip`.

- DMG SHA-256: `07b52cae0bce4cc673ef48894cc2624be7042725848382e4fe7508d66588d1f2`.
- Установочный ZIP SHA-256: `81bf793fa52dbe7af448ab876f14056959435f444fb845080d1929cc8cb89100`.
- Внешний GitHub artifact ZIP SHA-256: `b25c5d1177a1aee92a64706579f4ce018b5ebcd5a03c8ca46cadf790f6813a54` — совпал с digest API.

Developer ID, нотариализация, Gatekeeper после скачивания с карантином, физический Mac владельца, macOS13, Intel Mac/Windows **не проверены / BLOCKED**. Системная защита не отключалась. [Инструкция установки](INSTALL-RU.txt). Пакет подготовлен для оценки, не опубликован как официальный релиз; пользовательская приёмка ещё не проведена.
