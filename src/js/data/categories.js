export const CATEGORIES = [
  { key: 'app', ru: 'Страница приложения', en: 'App page' },
  { key: 'creator', ru: 'Диджитал-креатор', en: 'Digital creator' },
  { key: 'brand', ru: 'Бренд-страница', en: 'Brand page' },
  { key: 'community', ru: 'Сообщество', en: 'Community' },
  { key: 'market', ru: 'Продавец маркетплейса', en: 'Marketplace seller' },
  { key: 'launch', ru: 'Запуск продукта', en: 'Product launch' },
  { key: 'local', ru: 'Локальный бизнес', en: 'Local business' },
  { key: 'portfolio', ru: 'Портфолио', en: 'Portfolio' },
  { key: 'music', ru: 'Музыкальная страница', en: 'Music page' },
  { key: 'fitness', ru: 'Фитнес и здоровье', en: 'Fitness & health' },
  { key: 'travel', ru: 'Путешествия', en: 'Travel' },
  { key: 'tech', ru: 'Технологии', en: 'Tech page' }
];

export const catLabel = (key) => {
  const item = CATEGORIES.find((entry) => entry.key === key);
  return item ? item.en : key;
};
