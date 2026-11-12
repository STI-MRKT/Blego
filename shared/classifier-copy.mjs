import { CORE_FIELDS, CLASSIFIER_FIELDS } from './classifier.mjs';
import { serializeCopy } from './copy-format.mjs';
// Separate opt-in model; the ordinary import adapter's secret policy is unchanged.
export async function classifierCopy(records, { format = 'tsv', authorized = false } = {}) {
  if (!authorized || !['tsv', 'csv'].includes(format))
    throw Error('CLASSIFIER_COPY_REQUIRES_ACTION');
  const model = {
    fields: CORE_FIELDS.map((key) => ({
      key,
      label: CLASSIFIER_FIELDS.find((f) => f.key === key).label,
      sensitivity: 'personal',
      kind: key === 'accountId' ? 'id' : undefined
    })),
    fieldOrder: CORE_FIELDS,
    rows: records.map((r) => ({
      id: r.recordId,
      values: Object.fromEntries(CORE_FIELDS.map((k) => [k, r.data[k] || '']))
    }))
  };
  const result = await serializeCopy(
    {
      sourceIds: ['classifier-explicit'],
      scope: 'all',
      format,
      safetyMode: 'spreadsheet',
      includePersonal: true
    },
    { resolveSource: async () => model }
  );
  return result.text;
}
