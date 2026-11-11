export const FRIENDS = [
  { name: 'Ana Silva', handle: 'anasilva', geo: 'BR', niche: 'Fashion creator', hue: 12, url: 'https://www.instagram.com/anasilva/' },
  { name: 'Lucas Santos', handle: 'lucassantos', geo: 'BR', niche: 'Streetwear', hue: 198, url: 'https://www.instagram.com/lucassantos/' },
  { name: 'Beatriz Oliveira', handle: 'beaoliveira', geo: 'BR', niche: 'Beauty & style', hue: 330, url: 'https://www.instagram.com/beaoliveira/' },
  { name: 'Emily Carter', handle: 'emilycarter', geo: 'US', niche: 'Editorial', hue: 262, url: 'https://www.instagram.com/emilycarter/' },
  { name: 'Noah Bennett', handle: 'noahbennett', geo: 'US', niche: 'Menswear', hue: 214, url: 'https://www.instagram.com/noahbennett/' },
  { name: 'Ava Brooks', handle: 'avabrooks', geo: 'US', niche: 'Lifestyle', hue: 36, url: 'https://www.instagram.com/avabrooks/' },
  { name: 'Camille Moreau', handle: 'camillemoreau', geo: 'FR', niche: 'Luxury styling', hue: 286, url: 'https://www.instagram.com/camillemoreau/' },
  { name: 'Théo Laurent', handle: 'theolaurent', geo: 'FR', niche: 'Photography', hue: 170, url: 'https://www.instagram.com/theolaurent/' },
  { name: 'Zofia Nowak', handle: 'zofianowak', geo: 'PL', niche: 'Slow fashion', hue: 320, url: 'https://www.instagram.com/zofianowak/' },
  { name: 'Jakub Kowalski', handle: 'jakubkowalski', geo: 'PL', niche: 'Sneakers', hue: 88, url: 'https://www.instagram.com/jakubkowalski/' },
  { name: 'Lena Vogel', handle: 'lenavogel', geo: 'DE', niche: 'Minimal style', hue: 348, url: 'https://www.instagram.com/lenavogel/' },
  { name: 'Felix Braun', handle: 'felixbraun', geo: 'DE', niche: 'Tech & wearables', hue: 220, url: 'https://www.instagram.com/felixbraun/' },
  { name: 'Lucía Romero', handle: 'luciaromero', geo: 'ES', niche: 'Editorial', hue: 24, url: 'https://www.instagram.com/luciaromero/' },
  { name: 'Giulia Ricci', handle: 'giuliaricci', geo: 'IT', niche: 'Tailoring', hue: 8, url: 'https://www.instagram.com/giuliaricci/' },
  { name: 'Sanne de Vries', handle: 'sannedevries', geo: 'NL', niche: 'Concept store', hue: 186, url: 'https://www.instagram.com/sannedevries/' }
];

export const FRIEND_GEOS = [...new Set(FRIENDS.map((friend) => friend.geo))].sort();
