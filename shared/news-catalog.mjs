// Approved foreign-language RSS/Atom sources. No network calls until the user opens News.
// Entries can be replaced after a live feed check; failed feeds must never create synthetic stories.
export const NEWS_TOPICS = Object.freeze([
  { id: 'fashion', label: 'Мода' },
  { id: 'ai', label: 'ИИ' },
  { id: 'tech', label: 'Технологии' },
  { id: 'crypto', label: 'Криптовалюты' },
  { id: 'finance', label: 'Финансы' }
]);
export const NEWS_SOURCES = Object.freeze([
  {
    id: 'vogue-us',
    name: 'Vogue',
    topic: 'fashion',
    url: 'https://www.vogue.com/feed/rss'
  },
  {
    id: 'vogue-uk',
    name: 'British Vogue',
    topic: 'fashion',
    url: 'https://www.vogue.co.uk/feed/rss'
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
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    topic: 'ai',
    url: 'https://venturebeat.com/category/ai/feed/'
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
    id: 'blockworks',
    name: 'Blockworks',
    topic: 'crypto',
    url: 'https://blockworks.co/feed'
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
    id: 'economist-finance',
    name: 'The Economist',
    topic: 'finance',
    url: 'https://www.economist.com/finance-and-economics/rss.xml'
  },
  {
    id: 'ft',
    name: 'Financial Times',
    topic: 'finance',
    url: 'https://www.ft.com/rss/home/international'
  },
  {
    id: 'international-fashion',
    name: 'International fashion',
    topic: 'fashion',
    url: 'https://news.google.com/rss/search?q=fashion%20runway%20designer%20site%3Avogue.com%20OR%20site%3Awwd.com%20OR%20site%3Atheguardian.com&hl=en-US&gl=US&ceid=US%3Aen'
  },
  {
    id: 'international-ai',
    name: 'International AI',
    topic: 'ai',
    url: 'https://news.google.com/rss/search?q=artificial%20intelligence%20AI%20site%3Atechcrunch.com%20OR%20site%3Awired.com%20OR%20site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen'
  },
  {
    id: 'international-tech',
    name: 'International technology',
    topic: 'tech',
    url: 'https://news.google.com/rss/search?q=technology%20cybersecurity%20site%3Atheverge.com%20OR%20site%3Areuters.com%20OR%20site%3Aarstechnica.com&hl=en-US&gl=US&ceid=US%3Aen'
  },
  {
    id: 'international-crypto',
    name: 'International crypto',
    topic: 'crypto',
    url: 'https://news.google.com/rss/search?q=bitcoin%20crypto%20site%3Acoindesk.com%20OR%20site%3Acointelegraph.com%20OR%20site%3Adecrypt.co&hl=en-US&gl=US&ceid=US%3Aen'
  },
  {
    id: 'international-finance',
    name: 'International finance',
    topic: 'finance',
    url: 'https://news.google.com/rss/search?q=stocks%20finance%20site%3Areuters.com%20OR%20site%3Aft.com%20OR%20site%3Acnbc.com&hl=en-US&gl=US&ceid=US%3Aen'
  }
]);
export const sourcesForTopic = (topic) =>
  NEWS_SOURCES.filter((source) => source.topic === topic).map((source) => source.id);
