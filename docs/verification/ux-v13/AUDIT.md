# BLEGO UX v13 — этап 0, фактический аудит

2026-11-12. **Этапы 1–7 ещё не реализованы. Готовность нового UX/DMG не заявляется.**

## Git и контрольные точки

Начальное дерево `/workspace/BLEGO` чистое, ветка `codex/blego-local-v1`, HEAD `0f72a89cbc1cbfbb31a9bb576dbba2ef7fcdb220`. Оно сохранено. `git fetch origin` первоначально не смог подключиться к proxy:8080 из песочницы; тот же fetch через разрешённое облачное выполнение прошёл. Это не отказ авторизации GitHub.

| Роль | SHA / ветка | Наблюдение |
| --- | --- | --- |
| Единственный визуальный эталон | `6e57eabfb5b51af4475b90686fa580b5ce57e9b0` | main по-прежнему здесь |
| Функциональная Mac-база | `7de572764e4f09c5b1a542fbec22161bd1be9f42` | [Mac CI 43225047042](https://github.com/STI-MRKT/Blego/actions/runs/43225047042) success; историческое доказательство, не новый кандидат |
| Экспериментальный UX | `fdd57e83cd8bcf87993c2f0b500ecd92932cbb10` | Только источник отдельных фрагментов, содержит новый ux.css |
| Дополнительно обнаруженная classic-ветка | `8c9535acf2df1404c3f2c577f782e3929c112145` | [Mac CI 43241671846](https://github.com/STI-MRKT/Blego/actions/runs/43241671846) failure на установленном приложении |
| Новая рабочая ветка | `codex/blego-original-ux-v13` | От 7de5727; изменения этапа 0 — только docs/evidence |

PR №1 open/draft, не изменён. Нет merge/force-push/Release. Classic CI: runtime PASS, unit/integration PASS, DMG step PASS, installed app FAIL, upload verified archive SKIPPED. Чтение полного job log вернуло HTTP 403; причина падения конкретного assertion пока не установлена. Не называем этот DMG проверенной поставкой.

## Визуальное доказательство

[Галерея четырёх refs](comparisons.html), [каталог снимков и controls/animations JSON](baseline/). 1280×900, dark, одинаковая Linux-среда; оригинал Electron 32.3.3, база/UX — 45.3.1, версии сохранены из соответствующих lockfiles. Native Mac text rendering/плавность этими снимками не измеряются. Синтетические данные, отдельный временный userData для каждого запуска; внешняя сеть и `/api/` заблокированы только для визуальной съёмки. Поэтому пустая/ошибочная news-карточка на снимке не является тестом реального feed.

Сняты Generator empty/hover/loading/result, Network, Checker, Photos empty/loaded, Archive, Import; отдельные News и Settings только там, где они реально существуют. В оригинале News встроен в Generator. Записаны текущие CSS animations, duration/playState/targets и все controls в каждом состоянии. Это снимки/инвентаризация живых состояний, **не запись видео и не измерение плавности Mac**. Console page errors при этих проходах: 0.

Основные отличия от оригинала при неизменных protected CSS:

- Generator: исчез `.avatar.xl`, служебная панель/статистика и длинный набор полей увеличивают высоту; основные действия и news уходят ниже экрана.
- Network: отсутствуют видимые gauge/packets/ping bars; вместо них техническая форма и JSON/details.
- Photos: фото представлено строкой таблицы; группа/лимиты/описания расположены выше date/GPS. В original — photo-grid и наглядные миниатюры.
- News: потеряны оригинальные компактные headline/meta/actions и loading skeleton.
- Archive расположен в середине навигации; technical детали присутствуют в текущих представлениях.

## Реально выполненные команды

ОС Debian GNU/Linux 13, kernel 6.18.57, x86_64; Node 24.22.1, npm 11.9.0. Выполнение только Codex Cloud. Все `--publish never`; обращения к ПК владельца отсутствуют.

| Команда | Результат |
| --- | --- |
| original: `npm_config_cache=/tmp/blego-npm npm ci --ignore-scripts --offline`, затем Electron install.js | PASS, pinned Electron 32.3.3 |
| original: `npm run dist -- --linux --dir --publish never` | PASS, `BLEGO-original/release/linux-unpacked`; не DMG |
| base: отдельный `npm ci --ignore-scripts --offline`, Electron install.js | PASS. Первоначальная общая node_modules symlink заменена отдельной установкой |
| base: `npm run verify` | PASS lint; unit 42/42; integration 71/71, skip 0 |
| base: `BLEGO_HEADLESS=1 npm run test:ui` после отдельной установки | PASS 3/3, skip 0 |
| base: `npm run pack:linux` с отдельными зависимостями | PASS, runtime gate сохранён |
| copy unpacked to `/tmp/blego-v13-baseline-installed/BLEGO`, `BLEGO_HEADLESS=1 node scripts/check-installed-app.cjs --executable .../blego --report ...` | PASS 3/3, реальное упакованное приложение вне checkout |
| `node /tmp/blego-audit-gui.cjs <worktree> <label> <output>` для 4 refs | PASS screenshot/control capture, 0 renderer errors |
| `NODE_USE_ENV_PROXY=1 node /tmp/blego-audit-feeds.cjs` | 25/26 кандидатов разобраны; источник Economist HTTP 402 |

Команды сборки использовали `XDG_CACHE_HOME=/tmp/blego-cache ELECTRON_BUILDER_CACHE=/tmp/blego-builder`. Логи: [logs](logs/). [Отчёт packaged Linux](installed-linux-baseline.json). Исходники разовых audit-скриптов сохранены как `.cjs.txt` (пути этой облачной сессии заданы явно).

Неблагоприятные попытки не скрыты: первый verify остановился на sandbox `spawnSync /usr/bin/perl EPERM`; вне песочницы повтор прошёл. Первый GUI-прогон дал METADATA_ENGINE_UNAVAILABLE во время замены общей node_modules; после отдельной установки 3/3 source и 3/3 packaged прошли. Первый pack с symlink зависимостей выдавал missing-path warnings; сборка с отдельными зависимостями повторена и запущена. Проверка executable внутри checkout закономерно отклонилась `INSTALLED_APP_MUST_BE_OUTSIDE_CHECKOUT`; gate не снимался, использована копия вне checkout.

## Proxy и metadata: границы доказательств

Проверка `tests/integration/proxy-transports.test.cjs` действительно создаёт локальные контрольные HTTP/HTTPS/SOCKS5 endpoints и TLS origin, auth/noauth/wrong auth, 429/503/invalid JSON/cancel. Это **PASS контрольных транспортов**, не внешний IP реального публичного прокси. SOCKS5h как явный input сейчас отвергается; локальный/remote DNS не разведены. Внешний public proxy и real-provider Trust — BLOCKED, не тестировались в этом аудите.

Дефект classic provider воспроизведён отдельно: risk `''`, `false` или `[]` преобразуются через Number в 0; далее assessment даёт trust 100. Отсутствие/неверный тип должно давать unknown. Требуется новый тест перед переносом.

`metadata-write.test.cjs` реально экспортировал JPEG/PNG/WebP с date/GPS, повторно читал теги и сравнивал originals/encoded/rendered pixels, ICC/alpha/orientation; privacy regression проверял конфликтующие GPS namespaces. Group/reference/cancel/retry/restart также прошли. Это работа существующего Linux backend, **не завершённый новый Photos UX и не новая проверка native M1**.

## Реальные новости — предварительный audit, не приёмка тем

[Полный отчёт](feed-audit.json): HTTP chain, content type, counts, sample title/link, timestamps. Использован существующий parser/fetcher из classic reference через Cloud HTTP proxy. Счётчики ниже для прямых редакционных кандидатов, без 5 Google News search fallback feeds:

| Тема | Кандидатов | Успешно разобрано | Материалов до межисточниковой нормализации |
| --- | ---: | ---: | ---: |
| Fashion | 4 | 4 | 122 |
| AI | 4 | 4 | 57 |
| Cryptocurrency | 4 | 4 | 142 |
| Finance | 4 | 3 | 78 |
| Technology | 5 | 5 | 120 |

Каждый Google fallback дал ещё по 100 записей; это не одобрение их включения. В итоговом JSON приведены и общие exact-link unique counts. Displayed — null: приложение с новым каталогом ещё не реализовано. Ссылки не обходились массово; topical relevance, freshness каждого материала, tracking-дубли и правила использования ещё проверяются. Поэтому **20 реальных отображённых актуальных статей на тему пока BLOCKED**. HTTP 402 не обходился.

## Приоритеты обнаруженных проблем

| Приоритет | Проблема | Статус |
| --- | --- | --- |
| P0 | Утраченные Network gauge/cards и Photos thumbnails/главные date/GPS действия | FAIL сравнение с original |
| P0 | Classic risk type coercion может дать ложные 100/100 | FAIL воспроизведён |
| P0 | Proxy local/service addresses, SOCKS5h, разные error classes; speed resource/cancel boundaries | FAIL code audit / неполное покрытие |
| P0 | News не имеет принятого каталога/тем, refresh/cache races, private redirects, только UTF-8 | FAIL соответствие новому ТЗ |
| P0 | Classic installed Mac test | FAIL CI; полный log недоступен 403 |
| P1 | FB Check только нормализует, live отдельным действием; реальные ответы не приняты | FAIL UX / BLOCKED live |
| P1 | Generator aesthetics/технические поля; исторические ограничения словарей | FAIL визуально; прежние ограничения не сняты |
| P2 | Archive позиция/плотность/служебные детали; неполное per-button GUI покрытие | FAIL UX / BLOCKED часть кнопок |
| Gate | Новый native runtime/ARM64 DMG/installed Mac/performance/signing | BLOCKED: нового кандидата ещё нет; текущий executor Linux |
| Gate | Предметная классификация | BLOCKED rules_pending; не запрашивается и не придумывается |

[Карта функций](FUNCTION_MAP.md) отделяет фактические операции/тесты от неподтверждённых кнопок. [Предложение минимальных изменений](../../plans/BLEGO_ORIGINAL_UX_V13_DESIGN.md) — следующий reviewable результат. До утверждения продуктовый код и защищённая графика не меняются.
