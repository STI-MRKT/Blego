export async function parseIds(text) {
  if (!window.blego) throw Error('Open the desktop app for profile diagnostics');
  const normalized = await window.blego.normalizeFacebook(text);
  return normalized.inputRows.map((row) => ({
    id: row.target || row.raw,
    inputIndex: row.inputIndex,
    type: row.kind === 'id' ? 'numeric' : row.kind === 'username' ? 'vanity' : 'invalid',
    status: row.reasonCode || 'Valid syntax only',
    link: row.canonicalUrl || '',
    targetKey: row.canonicalUrl,
    notes: normalized.manualNotes[row.canonicalUrl] || []
  }));
}
export async function checkProfiles(rows, runId, onProgress) {
  const targets = [...new Map(rows.map((row) => [row.link, { canonicalUrl: row.link }])).values()];
  let done = 0;
  const unsubscribe = window.blego.onFacebookResult((result) => {
    if (result.runId === runId) onProgress?.(++done, targets.length, result);
  });
  try {
    return await window.blego.checkFacebook({ targets, runId });
  } finally {
    unsubscribe();
  }
}
