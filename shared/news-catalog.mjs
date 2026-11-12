// Public editorial RSS/Atom feeds; audited 2026-11-12. See UX3 source report for usage limits.
export const NEWS_TOPICS = Object.freeze([
  {
    id: 'fashion',
    label: 'Fashion'
  },
  {
    id: 'ai',
    label: 'Artificial Intelligence'
  },
  {
    id: 'crypto',
    label: 'Cryptocurrency'
  },
  {
    id: 'finance',
    label: 'Finance'
  },
  {
    id: 'tech',
    label: 'Technology'
  }
]);
export const NEWS_SOURCES = Object.freeze([
  {
    id: 'vogue-us',
    name: 'Vogue',
    topic: 'fashion',
    url: 'https://www.vogue.com/feed/rss'
  },
  {
    id: 'wwd',
    name: 'WWD',
    topic: 'fashion',
    url: 'https://wwd.com/feed/'
  },
  {
    id: 'guardian-fashion',
    name: 'The Guardian Fashion',
    topic: 'fashion',
    url: 'https://www.theguardian.com/fashion/rss'
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    topic: 'ai',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/'
  },
  {
    id: 'wired-ai',
    name: 'WIRED AI',
    topic: 'ai',
    url: 'https://www.wired.com/feed/tag/ai/latest/rss'
  },
  {
    id: 'guardian-ai',
    name: 'The Guardian AI',
    topic: 'ai',
    url: 'https://www.theguardian.com/technology/artificialintelligenceai/rss'
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    topic: 'tech',
    url: 'https://techcrunch.com/feed/'
  },
  {
    id: 'ars',
    name: 'Ars Technica',
    topic: 'tech',
    url: 'https://feeds.arstechnica.com/arstechnica/index'
  },
  {
    id: 'verge',
    name: 'The Verge',
    topic: 'tech',
    url: 'https://www.theverge.com/rss/index.xml'
  },
  {
    id: 'engadget',
    name: 'Engadget',
    topic: 'tech',
    url: 'https://www.engadget.com/rss.xml'
  },
  {
    id: 'wired',
    name: 'WIRED',
    topic: 'tech',
    url: 'https://www.wired.com/feed/rss'
  },
  {
    id: 'coindesk',
    name: 'CoinDesk',
    topic: 'crypto',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/'
  },
  {
    id: 'cointelegraph',
    name: 'Cointelegraph',
    topic: 'crypto',
    url: 'https://cointelegraph.com/rss'
  },
  {
    id: 'decrypt',
    name: 'Decrypt',
    topic: 'crypto',
    url: 'https://decrypt.co/feed'
  },
  {
    id: 'bbc-business',
    name: 'BBC Business',
    topic: 'finance',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml'
  },
  {
    id: 'marketwatch',
    name: 'MarketWatch',
    topic: 'finance',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories'
  },
  {
    id: 'guardian-business',
    name: 'The Guardian Business',
    topic: 'finance',
    url: 'https://www.theguardian.com/business/rss'
  }
]);
export const newsTopic = (value) => (NEWS_TOPICS.some((t) => t.id === value) ? value : 'fashion');

// Broad feeds need a topical match; this is a news filter, not the pending user-data classifier.
const matches = {
  fashion:
    'fashion|designer|runway|couture|style|streetwear|collection|wardrobe|dress|jeans|denim|shoe|handbag|outfit|jewel|vogue|wwd',
  finance:
    'financ|econom|market|stock|share|bank|invest|inflation|interest rate|trade|business|retail|profit|revenue|budget|tax|currency|pound|dollar|fund|earnings|bonds|mortgage|debt',
  tech: 'technolog|computer|software|hardware|internet|cyber|security|digital|artificial intelligence|\\bAI\\b|robot|chip|semiconductor|smartphone|iphone|android|apple|google|microsoft|nvidia|gaming|game|console|science|research|space|satellite|electric|battery|startup|venture'
};
export function relevantNews(source, title, description, link) {
  if (/^(?:sponsored|advertisement|press release)\b/i.test(title)) return false;
  const pattern = matches[source.topic];
  return (
    !NEWS_SOURCES.some((s) => s.id === source.id) ||
    !pattern ||
    new RegExp(pattern, 'i').test(title + ' ' + new URL(link).pathname)
  );
}
