# Карта функций — базовый кандидат 7de5727

Все PASS ниже ограничены указанным сценарием и **Linux x64**, 2026-11-12. Это не приёмка нового UX или Mac. Unit 42/42, integration 71/71, source GUI 3/3, packaged GUI вне checkout 3/3. `BLOCKED` здесь означает отсутствующее доказательство/зависимость; отсутствие отдельного GUI-теста отмечено явно, а не скрыто skip. Полный перечень статических `data-action` и ссылок на обработчики: `control-inventory.json`; реальные видимые/скрытые controls каждого снятого экрана: `baseline/*-audit.json`. Наличие обработчика само по себе не PASS.

| Элемент / action | Обработчик → операция | Успех / ошибка в UI | Фактическое покрытие и статус |
| --- | --- | --- | --- |
| Navigation `set-view` | main click → state.view/renderAll; Archive list IPC | Нужный экран / toast list error | PASS переходы в source/packaged GUI; FAIL Archive пока не последний |
| Country/Type, Generate | bindView/generate → generateProfile → SQLite registry | Сохранённая female card / toast exhaustion | PASS generator tests + `ui/app`; FAIL внешний вид/видимость основных полей |
| Clear profile | clear-demo → clearCard | Убирает текущую карточку без очистки registry | Backend coverage generator-registry; отдельный GUI clear BLOCKED |
| Copy field / Copy card | copy/copy-model → serializer → clipboard.write/read | Toast только после записи / error | PASS `ui/app`, `copy-all-sections`, native clipboard Linux |
| Copy panel: format/fields/rows/filter/page/preview/commit/sequence | `copy-actions.js` delegated handlers → copySource/serializeCopy/native clipboard | Preview и подтверждение / error toast | PASS основной selection/filter/format/keyboard/privacy сценарий; не каждый sequence button отдельно — BLOCKED |
| Cmd/Ctrl+Shift+C | copy keydown → resolved whole model | Clipboard / error | PASS Linux Ctrl; Cmd на новом Mac кандидате BLOCKED |
| Network Check proxy/direct | runProxyCheck → IPC checkProxy → transport → providers → assess | IP/result либо failed code/error banner | PASS controlled real socket HTTP/HTTPS/SOCKS5 auth/noauth + wrong auth; внешний публичный маршрут BLOCKED; ошибка auth сейчас не отличима от TRANSPORT_FAILED — FAIL |
| Proxy Cancel | cancelProxy → AbortController | Cancelled error, не success | PASS pre-aborted transport regression; live in-flight GUI cancel BLOCKED |
| SOCKS5h input | parseProxy | Сейчас INVALID_PROXY | FAIL явный socks5h не принимается; socks5 сейчас принудительно использует remote DNS |
| Proxy host guard | parseProxy/ipLookup | Ввод локального host пока не отсекается | FAIL по проверке кода; фиксированный IP target не закрывает доступ к локальному proxy endpoint |
| Trust | assess/providers | Старый heuristic + sources JSON | FAIL базовый Trust отсутствует. Classic adapter пустой risk→0 воспроизведён; live source BLOCKED |
| Run diagnostics | runNetwork → getNetworkInfo/getIpInfo/getPing/getSpeed | Сейчас JSON в details / error message | FAIL графика; TCP method есть, speed только explicit; full real network/TTFB GUI BLOCKED |
| Latency cancel / size-bound download | server pingAll/speedTest | Отдельного cancel нет; arrayBuffer без верхней streaming границы | FAIL требованиям; нет отдельного теста cancellation/oversize |
| News Refresh | refreshNews/loadNews → news.refreshNews → fetchFeed/parseFeed → SQLite news | Cached cards/error / last successful snapshot | PASS controlled cache/rate/error tests; FAIL встроенный каталог/пять тем отсутствуют в базе |
| News topic | news-topic → state.news.topic | Локальный фильтр, не тематическая загрузка | FAIL новый сценарий; persistence выбранной темы ещё отсутствует |
| News Cancel | cancelNews → controller.abort | Старый набор сохраняется | Backend tests; отдельный GUI cancel BLOCKED |
| News article link | anchor → Electron external URL validator → shell.openExternal | Открытие разрешённого HTTP(S) / reject invalid URL | PASS validator tests; реальное открытие внешнего браузера BLOCKED |
| News Copy title/link/card | unified clipboard/source | Текст в системном clipboard / error | PASS synthetic news fixture GUI; live cards ещё не приняты |
| FB Check | checker-run → parseIds → normalization IPC | Таблица нормализации / toast | PASS single/multiline/link unit+GUI; FAIL одна кнопка не выполняет public availability, требует отдельной Live status |
| FB Live status / Cancel | runCheckerStatus/checkProfiles → Facebook queue/transport/inspect | Progress, availability and evidence; unknown official ban state / safe codes | PASS controlled response/queue/cancel/redirect tests; реальная доступность public FB на новом кандидате BLOCKED |
| FB Open / notes/history | openFacebook/saveFacebookNote IPC | Safe external URL; локальная owner note / toast | PASS normalize/note separation backend; отдельные GUI действия BLOCKED |
| FB Clear / copy IDs/links | checker-clear/copy model | Очистка после cancel / clipboard | PASS copy GUI; clear during live operation BLOCKED |
| Add images / select / remove / clear | addPhotos/workspaceChange/removePhoto/clearPhotos → authorized file tokens, readImageMetadata | Ready/selected или safe error | PASS actual chooser-controlled GUI + read/limits integration; native dialog mouse interaction BLOCKED |
| Image preview / copy pixels | image-preview/image-copy → image service preview/clipboard | Bitmap preview/native PNG clipboard / error | PASS metadata pixel/alpha/orientation GUI and integration |
| Date/GPS Keep/Set/Remove | metadata-form → readMetadataData/applyImageForm → existing group/override policy | Validated operations or validation toast | PASS actual JPEG/PNG/WebP integration date+GPS write/readback (incl zero); FAIL date/GPS buried below table/group controls |
| Preview / destination choice | form submit → prepareImageExport → planGroupExport | Immutable before/after plan / stale/path/validation failure | PASS group-export/reference/UI fixtures; no random metadata defaults |
| Save copies | metadata-export → applyGroupExport → engine/export verification | Only completed files verified; failed/cancelled records retained | PASS actual date/GPS/ICC/alpha/orientation/pixel/original tests + source/packaged GUI |
| Cancel group/all / retry failed | metadata-cancel(-group)/metadata-retry → existing run IDs/queue | Cancelled/failed not success, selective fresh plan | PASS group export cancellation/idempotence/retry integration; complete visible new UX scenario BLOCKED |
| Group create/rename/delete/move/select/save/rules | group-* → workspace operations → same KV store | Updated group/workspace / toast validation | PASS workspace+group/UI save/restart/drafts; all confirmation buttons individually BLOCKED |
| Reference choose/use | reference-* → explicit allowed fields + source hash capability | Chosen-field operations / unavailable/stale error | PASS reference and GUI tests; none selected automatically |
| Preset save/import/rename/duplicate/delete/export/preview | preset-* / metadata-preset-* → existing preset service | Explicit snapshots/plan; validation or file dialog cancellation | PASS preset import/rename/delete semantics integration; every native dialog action individually BLOCKED |
| Export report | metadata-report → save report IPC | Export only after chosen path; fixed fields/no tag values | Backend tests; individual GUI save error cases BLOCKED |
| Import file/drag/page/copy/reset | handleFile/importPage/import-copy/reset → shared importer/classifier | Structural preview; empty missing fields; rules_pending | PASS parser/classification-contract/source GUI; предметная классификация BLOCKED rules_pending |
| Archive search/filter/sort/page | bindView/archive-page → listArchives | Filtered list / toast error | PASS backend date filters + copy filter GUI; every sort/filter GUI separately BLOCKED |
| Archive Open/Back/Copy | archive-open/back/copy model → openArchive/verified ZIP | Result view/text / corrupt archive error | PASS archive roundtrip, GUI synthetic test-only result |
| Archive TXT/ZIP export | archive-export → exportArchive → dialog + no-overwrite write | Toast only if r.ok / toast on exception | Backend archive tests; отдельный actual GUI TXT/ZIP save dialog BLOCKED |
| Archive Open folder | archive-folder → archiveFolder → shell | Opens folder; current renderer does not await/report reject | BLOCKED real window-manager action; error feedback needs fix |
| Archive Delete | archive-delete → removeArchive native confirm + store/delete | Refresh only after confirmed deletion | PASS backend delete/data retention; native confirm GUI separately BLOCKED |
| Settings/pools/archive directory | form change/pool-*/archive-directory → existing settings/vault/pool service | Persisted settings or validation toast | PASS settings/pool-catalog/storage-upgrade + restart GUI; retain values while hiding technical UI |
| Friends GEO | friends-geo → state/renderView | Existing local names/cards | Static handler exists; отдельный functional GUI test BLOCKED, no redesign planned |
| Legacy modal controls | open-entry/ask-delete/delete-entry/close-modal/overlay | Legacy history modal | Inventory only; not substitute for current SQLite archive. Reachability/behavior audit before removal, BLOCKED |

## Обязательные границы дальнейшей приёмки

- Tests with a synthetic body/IP prove controlled transport behavior, not the exit IP of a public user proxy.
- Test-only archive classifiers are fixtures, not subject rules. Pending imports must not become classified ZIPs.
- Metadata evidence is actual ExifTool writes on Linux fixtures, not a claim of new Mac GUI export.
- Live feed audit establishes HTTP/parsing only. Valid URL syntax does not establish every linked article is reachable/current/relevant or licensed for display.
- User settings/history persist in current tests; no real user dataset was opened. All screenshots/data were generated in isolated temporary stores.
