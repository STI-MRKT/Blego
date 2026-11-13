# Сравнительные снимки BLEGO 1.4.1

Дополнение: [классификатор с видимыми паролями](password-display/classifier-passwords-mac.png), установленный Mac-кандидат `1676e92`; в кадре только синтетические данные. Сравнительная галерея ниже сохраняет исходный кандидат `b6afdf0`.

Источник: фактические окна Electron на macOS ARM64, кандидат `b6afdf04cb9d10996634279adc17273c3c2640b2`. Кадры не ретушировались. Оригинал `6e57eab` запущен из отдельного checkout; версия 1.4 `95b80ff` и кандидат — упакованные приложения вне checkout. Синтетические записи не являются пользовательскими данными.

Для сравнения заданы одинаковые renderer viewport 1280×900 и 980×720, поскольку рабочая область CI-дисплея ограничивает нативную высоту. Это не подменяет отдельный тест настоящего изменения размеров установленного окна: его результаты находятся в `native/responsive-native.json`. BIO и рабочие сценарии сняты при фактических границах окна; нижние поля доступны вертикальной прокруткой. Видимые уведомления — реальные состояния сценария.

| Раздел | Оригинал | BLEGO 1.4 | BLEGO 1.4.1 |
|---|---|---|---|
| Generator | [Открыть](screens/ux-original-generator-1280.png) | [Открыть](screens/ux-baseline14-generator-1280.png) | [Открыть](screens/ux-candidate-generator-1280.png) |
| Network | [Открыть](screens/ux-original-network-1280.png) | [Открыть](screens/ux-baseline14-network-1280.png) | [Открыть](screens/ux-candidate-network-1280.png) |
| Import | [Открыть](screens/ux-original-import-1280.png) | [Открыть](screens/ux-baseline14-import-1280.png) | [Открыть](screens/ux-candidate-import-1280.png) |
| Photos | [Открыть](screens/ux-original-photos-1280.png) | [Открыть](screens/ux-baseline14-photos-1280.png) | [Открыть](screens/ux-candidate-photos-1280.png) |
| Archive | [Открыть](screens/ux-original-history-1280.png) | [Открыть](screens/ux-baseline14-history-1280.png) | [Открыть](screens/ux-candidate-history-1280.png) |
| Checker | [Открыть](screens/ux-original-checker-1280.png) | [Открыть](screens/ux-baseline14-checker-1280.png) | [Открыть](screens/ux-candidate-checker-1280.png) |
| News | В исходной навигации нет отдельного пункта | [Открыть](screens/ux-baseline14-news-1280.png) | [Открыть](screens/ux-candidate-news-1280.png) |

Дополнительно: [BIO](screens/bio-wide.png), [BIO 360px](screens/bio-360.png), [360px](screens/responsive-360.png), [480px](screens/responsive-480.png), [карта до](screens/map-files-before.png), [карта после](screens/map-files-after.png). До/после — офлайн-точки и границы тестовых фотографий, а не доказательство загрузки географической подложки. Фактический ответ публичного картографического сервиса и его отрисовка оцениваются отдельно в NATIVE.md.

Исходные CSS tokens/base/components/shell/tools/views и графические ресурсы не изменены относительно оригинала. Это дополнительная проверка; визуальный вывод опирается также на сами снимки и GUI-сценарии.

Реальная географическая подложка: [мировой тайл OSM в установленном приложении](screens/map-live-world.png), PASS — native/public-services-native.json.
