/** Local v1: parsing is not subject classification. All timestamps are ISO UTC. */
export const MAX_INPUT_BYTES = 50 * 1024 * 1024;
export const RESULT_STATUSES = Object.freeze([
  'rules_pending',
  'preview_complete',
  'preview_partial',
  'completed',
  'partial_confirmed',
  'cancelled',
  'failed'
]);
export const ARCHIVABLE_STATUSES = Object.freeze(['completed', 'partial_confirmed']);
export function failure(code, stage, details) {
  return Object.assign(new Error(code), { code, stage, details });
}
