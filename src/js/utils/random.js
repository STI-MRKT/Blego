export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const digits = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
export const pad2 = (value) => String(value).padStart(2, '0');
export const slugify = (value) => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ł/g, 'l')
  .replace(/[^a-z0-9]/g, '');
export const hueOf = (value) => {
  let hue = 0;
  for (const char of String(value)) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
};
export const initialsOf = (name) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();
