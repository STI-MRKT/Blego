import { seedHistory } from './data/seed.js';

export const state = {
  view: 'generator',
  settings: {newsEnabled:false,proxyEnabled:false},
  locale: 'BR',
  demo: null,
  demoBusy: false,
  importStep: 'idle',
  importName: '',
  importKind: '',
  importData: null,
  importError: '',
  importSaved: null,
  historyQuery: '',
  history: seedHistory(),
  modal: null,
  news: { items: [], counts: {}, loading: false, error: '', updatedAt: 0, topic: '', order: [] },
  network: {
    running: false,
    stage: '',
    ip: null,
    ping: null,
    speed: null,
    info: null,
    proxyInput: '',
    proxy: null,
    proxyLoading: false,
    proxyError: '',
    error: ''
  },
  photos: [],
  friendsGeo: '',
  checker: { input: '', rows: null, checking: null }
};
