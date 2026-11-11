import { LOCALES } from '../data/locales.js';
import { CATEGORIES } from '../data/categories.js';
import { pick, slugify, hueOf } from '../utils/random.js';

export function pickCategories(count) {
  const pool = CATEGORIES.map((item) => item.key);
  const result = [];
  while (result.length < count && pool.length) {
    result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return result;
}

export function makeDemo(localeKey) {
  const locale = LOCALES[localeKey];
  const first = pick(locale.first);
  const last = locale.lastF && locale.female.includes(first) ? pick(locale.lastF) : pick(locale.last);
  const city = pick(locale.cities);
  const name = `${first} ${last}`;
  const handle = `${slugify(first)}.${slugify(last)}`;
  const phone = locale.phone();
  const now = Date.now();
  return {
    id: `d${now}`,
    locale: localeKey,
    name,
    first,
    last,
    handle,
    categories: pickCategories(3),
    bio: pick(locale.bio),
    phone,
    phoneCopy: phone.replace(/^\+\d{1,3}\s?/, '').trim(),
    email: `${handle}@atomicmail.io`,
    address: `${pick(locale.streets)} ${1 + Math.floor(Math.random() * 240)}`,
    city: city.city,
    postal: city.postal,
    hue: hueOf(name),
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000
  };
}
