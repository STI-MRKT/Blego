# Photos map — consolidated specification §8

Extend the existing Photos view and revisioned GPS operations. Use a small offline Canvas 2D renderer over GeoJSON, rather than a new app framework or online map provider. Canvas is an open browser standard already available in sandboxed Electron; it avoids mandatory tile access, WebGL availability and added runtime downloads. The existing licensed OSM boundaries provide local geographic context. Explicitly label the view as local contours without a street/satellite basemap. No remote tile requests or photo/metadata transmission are introduced.

Display uses longitude/latitude coordinates on a local equirectangular view; this is a visualization only. The established spherical-area sampling and validated point-in-polygon rules remain the authority for generation and marker moves. No radius or spread modes.

- Pure shared model resolves before GPS, effective after GPS, missing GPS, fit bounds and pixel-cell clusters; coordinates are never mutated by rendering, zoom, fit or resize.
- Canvas redraw is bounded to at most 1000 points and the existing bounded geometry, scheduled with requestAnimationFrame. ResizeObserver changes only the backing display size. State holds viewport/mode/selected file across view updates.
- Before/After buttons, zoom in/out, fit, keyboard panning and a file selector. Clusters zoom to members and separate as scale increases. Selecting a file shows thumbnail/name/before/after/status, also highlights its list card.
- Only explicitly selected After markers can be moved; the backend validates rounded coordinates inside the selected city's geometry and against other files, rechecks workspace revision, changes only that file's GPS override, preserves altitude policy and invalidates old plans. Exact manual coordinates remain in their existing separate editor.
- City geometry is returned through a bounded IPC/worker route, never filesystem access from renderer. Stale geometry/drag responses cannot replace a new city or selection.
- Missing GPS gets an explicit count/list; never fabricate a point at 0,0. Zero coordinates are valid when actually present.
- Tests: pure model, clusters and 1000 points; backend out-of-city/duplicate/stale/zero moves; actual canvas click/drag/pan/zoom/Before-After and no external traffic; narrow resizing retains viewport and active work. Native installed performance remains a separate gate.
