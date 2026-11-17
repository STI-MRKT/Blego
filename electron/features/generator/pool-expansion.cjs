// TZ14 deterministic, offline supplemental variation. All generated entries are
// synthetic; locations and official institution identities are never invented.
const COUNT = 150;
const normalized = (value) => String(value).normalize('NFKC').trim().toLocaleLowerCase();
function uniqueExpansion(existing, candidates, count = COUNT) {
  const seen = new Set(existing.map(normalized)), output = [];
  for (const value of candidates) {
    if (typeof value !== 'string' || !value.trim() || seen.has(normalized(value))) continue;
    seen.add(normalized(value));
    output.push(value);
    if (output.length === count) break;
  }
  if (output.length < count) throw Error('TZ14_POOL_TOO_SMALL');
  return output;
}
function compoundNames(existing, separator) {
  const candidate = [];
  for (let step = 1; step < existing.length; step++) {
    for (let i = 0; i < existing.length; i++) {
      const j = (i + step) % existing.length;
      candidate.push(existing[i] + separator + existing[j]);
      if (candidate.length >= COUNT * 5) break;
    }
    if (candidate.length >= COUNT * 5) break;
  }
  return uniqueExpansion(existing, candidate);
}
const nature = [
  'Willow', 'Cedar', 'Oak', 'Maple', 'Elm', 'Birch', 'Hazel', 'Ash',
  'Laurel', 'Orchard', 'Rose', 'Linden', 'Ivy', 'Rowan', 'Hawthorn'
];
const stems = {
  BR: ['das Acácias','dos Ipês','das Palmeiras','das Rosas','dos Cedros','das Oliveiras','dos Pinheiros','das Camélias','das Orquídeas','do Sol','das Violetas','das Magnólias','da Serra','das Hortênsias','dos Lírios'],
  FR: ['des Tilleuls','des Acacias','des Roses','des Mimosas','des Lilas','des Érables','des Saules','des Chênes','des Jardins','des Cerisiers','des Violettes','des Pins','des Magnolias','des Peupliers','des Lavandes'],
  PL: ['Wrzosowa','Jaśminowa','Topolowa','Brzozowa','Lipowa','Różana','Sosnowa','Klonowa','Bukowa','Ogrodowa','Kwiatowa','Słoneczna','Akacjowa','Leśna','Polna'],
  DE: ['Linden','Birken','Rosen','Kiefern','Ahorn','Eichen','Blumen','Garten','Weiden','Buchen','Sonnen','Flieder','Fichten','Kastanien','Pappel'],
  ES: ['de los Olmos','de las Flores','de los Cedros','de las Rosas','de los Pinos','de las Encinas','de los Jardines','de los Álamos','de las Acacias','de las Violetas','del Sol','de la Luna','de las Magnolias','de la Sierra','de los Tilos'],
  IT: ['dei Tigli','delle Rose','dei Cedri','delle Magnolie','dei Pini','delle Acacie','dei Fiori','dei Giardini','dei Salici','delle Viole','degli Olmi','dei Gelsomini','dei Castagni','delle Betulle','delle Orchidee'],
  US: nature, GB: nature
};
const forms = {
  BR: ['Rua','Avenida','Travessa','Alameda','Praça','Estrada','Largo','Viela','Passeio','Caminho'],
  FR: ['Rue','Avenue','Allée','Impasse','Passage','Place','Boulevard','Chemin','Square','Cours'],
  PL: ['ul.','aleja','plac','skwer','osiedle','bulwar','rondo','pasaż','trakt','deptak'],
  DE: ['straße','weg','allee','platz','ring','pfad','gasse','ufer','steig','hain'],
  ES: ['Calle','Avenida','Plaza','Paseo','Camino','Ronda','Travesía','Pasaje','Carrer','Alameda'],
  IT: ['Via','Viale','Vicolo','Corso','Piazza','Strada','Largo','Passeggiata','Salita','Traversa'],
  US: ['Street','Lane','Road','Drive','Way','Court','Avenue','Place','Terrace','Walk'],
  GB: ['Street','Lane','Road','Drive','Way','Close','Mews','Walk','Court','Avenue']
};
function streetFor(country, root, form) {
  if (country === 'DE') return root + form;
  if (country === 'US' || country === 'GB') return root + ' ' + form;
  return form + ' ' + root;
}
function expandedStreets(country, base) {
  const candidate = [];
  for (const root of stems[country])
    for (const form of forms[country])
      candidate.push(streetFor(country, root, form));
  return uniqueExpansion(base, candidate);
}
function expandCountry(data) {
  const country = data.code;
  return {
    ...data,
    first: [...data.first, ...compoundNames(data.first, ' ')],
    last: [...data.last, ...compoundNames(data.last, ['BR','ES','IT'].includes(country) ? ' ' : '-')],
    streets: [...data.streets, ...expandedStreets(country, data.streets)]
  };
}
function syntheticAddresses(data, count = COUNT) {
  const street = expandedStreets(data.code, data.streets);
  const output = [];
  for (let i = 0; i < count; i++) {
    const place = data.places[i % data.places.length];
    const number = 20 + i;
    const address = ['US','GB'].includes(data.code)
      ? number + ' ' + street[i]
      : street[i] + ' ' + number;
    output.push({city:place.city,postal:place.postal,address});
  }
  return output;
}
function expandBioPool(base, additional) {
  const candidates = [];
  for (let i = 0; i < COUNT; i++) {
    const first = base[i % base.length].trim();
    const second = additional[(i % base.length + Math.floor(i / base.length) * 11) % additional.length].trim();
    candidates.push(first + ' ' + second);
  }
  return uniqueExpansion([...base, ...additional], candidates);
}
function expandStatusPool(base) {
  const pieces = base.map((item) => item.split(' · '));
  const candidate = [];
  for (let i = 0; i < COUNT; i++) {
    const a = pieces[i % pieces.length];
    const b = pieces[(i % pieces.length + Math.floor(i / pieces.length) + 1) % pieces.length];
    candidate.push(a[0] + ' · ' + a.slice(1).join(' · ') + ' / ' + b.slice(1).join(' · '));
  }
  return uniqueExpansion(base, candidate);
}
const categoryEndings = [
  'Research','Community','Studio','Notes','Culture','Journal','Education','Workshop',
  'Collective','Projects','Ideas','Media','Practice','Insights','Discovery','Design',
  'Portfolio','Analysis','Perspectives','Network','Foundry','Lab','Discussion',
  'Resources','Innovation','Methods','Learning','Reference','Craft','Exploration',
  'Review','Digest','Updates','Experiments','Initiatives','Stories','Forum','Trends',
  'Space','Guides','Tools','Development','Vision','Archives','Connections','Fieldwork',
  'Concepts','Showcase','Observations','Progress'
];
function categoryPool(base) {
  return uniqueExpansion(base, base.flatMap((category) => categoryEndings.map((end) => category + ' ' + end)));
}
const roleNouns = ['Researcher','Editor','Coordinator','Designer','Specialist','Analyst','Producer','Consultant','Strategist','Manager'];
const roleThemes = {
  model: ['Fashion','Portrait','Creative','Editorial','Visual','Style','Brand','Image','Content','Studio','Campaign','Lifestyle','Photography','Media','Art'],
  tech: ['Software','AI','Data','Product','Interface','Platform','Systems','Research','Security','Cloud','Automation','Digital','Development','UX','Technology'],
  crypto: ['Blockchain','Ledger','Protocol','Web3','Digital Asset','Onchain','Smart Contract','Network','Cryptography','Decentralized','Token','Wallet','DeFi','Consensus','Open Finance']
};
function positionPool(type) {
  return roleThemes[type].flatMap((theme) => roleNouns.map((role) => theme + ' ' + role));
}
module.exports = {
  COUNT, expandCountry, syntheticAddresses, expandBioPool, expandStatusPool,
  categoryPool, positionPool
};
