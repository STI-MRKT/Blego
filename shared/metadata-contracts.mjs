export const IMAGE_LIMITS = Object.freeze({
  files: 100,
  fileBytes: 50 * 1024 * 1024,
  totalBytes: 512 * 1024 * 1024,
  pixels: 40_000_000,
  parallel: 2,
  engineMs: 60_000,
  engineBytes: 8 * 1024 * 1024
});
export const IMAGE_STATES = [
  'queued',
  'reading',
  'ready',
  'writing',
  'verifying',
  'completed',
  'no_changes',
  'unsupported',
  'cancelled',
  'failed'
];
export const METADATA_FIELDS = [
  'title',
  'description',
  'author',
  'copyright',
  'keywords',
  'comment',
  'captureDate',
  'make',
  'model',
  'software',
  'gps',
  'personalIdentifiers'
];
