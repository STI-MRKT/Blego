import { pick } from '../utils/random.js';

const PROJECTS = ['Q4 Launch', 'Brand Refresh', 'Creator Batch', 'Spring Campaign', 'Marketplace Test', 'Portfolio Sync', 'Local Pages', 'Community Push'];
const OWNERS = ['Camille Moreau', 'Lucas Silva', 'Maya Chen', 'Jakub Kowalski', 'Ana Souza', 'Noah Bennett', 'Zofia Nowak', 'Emily Carter'];
const NOTES = ['Hero assets ready', 'Awaiting copy', 'Rerun after review', 'Priority', '', 'Waiting on legal'];
const STATUSES = ['active', 'draft', 'paused', 'active'];

const hoursAgo = (hours) => Date.now() - hours * 3600e3;
const daysAgo = (days) => Date.now() - days * 86400e3;

function seedRows(count, withIssues) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const owner = pick(OWNERS);
    rows.push({
      project: pick(PROJECTS),
      owner,
      email: `${owner.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      note: pick(NOTES),
      status: pick(STATUSES)
    });
  }
  if (withIssues) {
    rows[1].owner = '';
    rows[2].email = 'maya.chen[at]example.com';
  }
  return rows;
}

export function seedHistory() {
  return [
    {
      id: 's1',
      name: 'q4_projects.csv',
      kind: 'CSV',
      date: hoursAgo(2),
      status: 'parsed',
      columns: ['project', 'owner', 'email', 'note', 'status'],
      rows: seedRows(128, false)
    },
    {
      id: 's2',
      name: 'creators_export.json',
      kind: 'JSON',
      date: hoursAgo(26),
      status: 'partial',
      columns: ['project', 'owner', 'email', 'note', 'status'],
      rows: seedRows(42, true)
    },
    {
      id: 's3',
      name: 'brand_pages.tsv',
      kind: 'TSV',
      date: daysAgo(3),
      status: 'parsed',
      columns: ['project', 'owner', 'email', 'note', 'status'],
      rows: seedRows(76, false)
    }
  ];
}
