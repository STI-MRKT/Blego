const STORAGE_KEY = 'blego.tour.v1';

const STEPS = [
  {
    view: 'generator',
    selector: '.nav-item[data-view="generator"]',
    title: 'Рабочая область',
    text: 'Генератор, импорт и история — в этой панели. Всё работает локально: без аккаунта и облака.'
  },
  {
    selector: '[data-input="locale"]',
    title: 'Выберите рынок',
    text: 'Страна и тип определяют синтетические имена, контакты и тематику. Все значения создаются локально.'
  },
  {
    selector: '[data-action="generate"]',
    title: 'Создайте профиль',
    text: 'Один клик — и синтетический профиль готов. Значения копируются отдельно или целиком; последний профиль сохраняется локально.'
  },
  {
    view: 'news',
    selector: '.news-head',
    title: 'Новости',
    text: 'Выберите тему и нажмите «Загрузить новости». Последняя успешная лента сохраняется для просмотра без сети.'
  },
  {
    view: 'network',
    selector: '[data-action="net-run"]',
    title: 'Проверка сети',
    text: 'Анимированные прибор скорости и графики TCP-пинга доступны после вашего разрешения на сетевые запросы. Репутация IP остаётся неизвестной без источников.'
  },
  {
    view: 'checker',
    selector: '.checker-card',
    title: 'Чекер',
    text: 'Вставьте ID или ссылки на профили. Публичная доступность может зависеть от сети и не доказывает наличие или отсутствие блокировки аккаунта.'
  },
  {
    finish: true,
    title: 'Готово',
    text: 'Это была короткая экскурсия. Любой раздел можно открыть в левой панели. Больше инструкция не появится.'
  }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function hasSeenTour() {
  try {
    if (window.blego?.tourSeen) return await window.blego.tourSeen();
  } catch {
    void 0;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    void 0;
  }
  try {
    window.blego?.markTour?.();
  } catch {
    void 0;
  }
}

export async function startTour({ navigate, shouldStart = () => true } = {}) {
  if (await hasSeenTour()) return false;
  if (!shouldStart()) return false;
  if (document.getElementById('tour-root')) return false;
  markTourSeen();

  const root = document.createElement('div');
  root.id = 'tour-root';
  root.innerHTML = `
    <div class="tour-block"></div>
    <div class="tour-block"></div>
    <div class="tour-block"></div>
    <div class="tour-block"></div>
    <div class="tour-ring"></div>
    <div class="tour-tip" role="dialog" aria-live="polite">
      <div class="tour-arrow"></div>
      <div class="tour-step"></div>
      <h3 class="tour-title"></h3>
      <p class="tour-text"></p>
      <div class="tour-actions">
        <button class="btn btn-quiet" data-tour-action="skip">Пропустить</button>
        <span style="flex:1"></span>
        <button class="btn" data-tour-action="back">Назад</button>
        <button class="btn btn-primary" data-tour-action="next">Далее</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const blocks = [...root.querySelectorAll('.tour-block')];
  const ring = root.querySelector('.tour-ring');
  const tip = root.querySelector('.tour-tip');
  const title = root.querySelector('.tour-title');
  const text = root.querySelector('.tour-text');
  const counter = root.querySelector('.tour-step');
  const nextButton = root.querySelector('[data-tour-action="next"]');
  const backButton = root.querySelector('[data-tour-action="back"]');

  let index = 0;
  let current = null;

  const finish = () => {
    markTourSeen();
    root.remove();
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    document.removeEventListener('keydown', onKey);
  };

  const setBlocks = (rect, full = false) => {
    if (full) {
      blocks[0].style.cssText = 'left:0;top:0;right:0;bottom:0';
      for (let i = 1; i < blocks.length; i += 1) blocks[i].style.cssText = 'display:none';
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 6;
    blocks[0].style.cssText = `left:0;top:0;width:${vw}px;height:${Math.max(0, rect.top - pad)}px`;
    blocks[1].style.cssText = `left:0;top:${rect.bottom + pad}px;width:${vw}px;height:${Math.max(0, vh - rect.bottom - pad)}px`;
    blocks[2].style.cssText = `left:0;top:${Math.max(0, rect.top - pad)}px;width:${Math.max(0, rect.left - pad)}px;height:${rect.height + pad * 2}px`;
    blocks[3].style.cssText = `left:${rect.right + pad}px;top:${Math.max(0, rect.top - pad)}px;width:${Math.max(0, vw - rect.right - pad)}px;height:${rect.height + pad * 2}px`;
  };

  const place = (target, step) => {
    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setBlocks(rect);
    ring.style.cssText = `display:block;left:${rect.left - 6}px;top:${rect.top - 6}px;width:${rect.width + 12}px;height:${rect.height + 12}px`;

    title.textContent = step.title;
    text.textContent = step.text;
    counter.textContent = `${index + 1} / ${STEPS.length}`;
    backButton.style.visibility = index === 0 ? 'hidden' : 'visible';
    nextButton.textContent = index === STEPS.length - 1 ? 'Начать работу' : 'Далее';

    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    tip.className = 'tour-tip';
    if (rect.height > vh * 0.75) {
      tip.classList.add('pos-floating');
      tip.style.left = `${clamp(rect.left + 24, 12, vw - width - 12)}px`;
      tip.style.top = `${vh - height - 18}px`;
    } else if (rect.left < 250) {
      tip.classList.add('pos-right');
      tip.style.left = `${rect.right + 16}px`;
      tip.style.top = `${clamp(rect.top + rect.height / 2 - height / 2, 12, vh - height - 12)}px`;
    } else if (rect.bottom + height + 22 < vh) {
      tip.classList.add('pos-below');
      tip.style.left = `${clamp(rect.left, 12, vw - width - 12)}px`;
      tip.style.top = `${rect.bottom + 16}px`;
    } else {
      tip.classList.add('pos-above');
      tip.style.left = `${clamp(rect.left, 12, vw - width - 12)}px`;
      tip.style.top = `${rect.top - height - 16}px`;
    }
  };

  const showFinish = () => {
    root.classList.add('is-finish');
    setBlocks(null, true);
    ring.style.display = 'none';
    tip.className = 'tour-tip';
    tip.style.left = `${(window.innerWidth - tip.offsetWidth) / 2}px`;
    tip.style.top = `${(window.innerHeight - tip.offsetHeight) / 2}px`;
  };

  const show = async (next) => {
    index = clamp(next, 0, STEPS.length - 1);
    const step = STEPS[index];
    current = step;
    if (step.finish) {
      title.textContent = step.title;
      text.textContent = step.text;
      counter.textContent = `${STEPS.length} / ${STEPS.length}`;
      nextButton.textContent = 'Начать работу';
      backButton.style.visibility = 'visible';
      showFinish();
      return;
    }
    if (step.view) navigate?.(step.view);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 180));
    const target = document.querySelector(step.selector);
    if (!target) {
      show(next + 1);
      return;
    }
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise((resolve) => setTimeout(resolve, 260));
    root.classList.remove('is-finish');
    blocks.forEach((block) => { block.style.display = 'block'; });
    place(target, step);
  };

  const reposition = () => {
    if (!current || current.finish) return;
    const target = document.querySelector(current.selector);
    if (target) place(target, current);
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tour-action]');
    if (!button) return;
    const action = button.dataset.tourAction;
    if (action === 'skip') return finish();
    if (action === 'back') return show(index - 1);
    if (action === 'next') {
      if (index >= STEPS.length - 1) return finish();
      return show(index + 1);
    }
  });

  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);
  const onKey = (event) => {
    if (event.key === 'Escape') finish();
    if (event.key === 'ArrowRight') {
      if (index >= STEPS.length - 1) finish();
      else show(index + 1);
    }
    if (event.key === 'ArrowLeft') show(index - 1);
  };
  document.addEventListener('keydown', onKey, { once: false });

  show(0);
  return true;
}
