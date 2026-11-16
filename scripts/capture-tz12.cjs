// Identical synthetic fixtures; source and installed builds use their own renderer/CSS.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { openStore } = require('../electron/local/store.cjs');
const { updateSettings } = require('../electron/local/settings.cjs');
async function main() {
  const project = path.resolve(process.argv[2] || '.');
  const label = process.argv[3] || 'candidate';
  const out = path.resolve(process.argv[4] || 'release/tz12-visual');
  fs.mkdirSync(out, { recursive: true });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blego-tz12-capture-'));
  const store = await openStore(root);
  store.set('tourSeen', true);
  updateSettings(store, { newsEnabled: false });
  store.close();
  let app;
  const metrics = [];
  try {
    app = await _electron.launch({
      executablePath: process.env.BLEGO_EXECUTABLE || undefined,
      cwd: project,
      args: [
        ...(process.env.BLEGO_HEADLESS ? ['--ozone-platform=headless', '--disable-gpu'] : []),
        ...(process.env.BLEGO_EXECUTABLE ? [] : [project]),
        `--user-data-dir=${root}`
      ]
    });
    const page = await app.firstWindow();
    await page.locator('[data-view="news"]').waitFor();
    await page.evaluate(async () => {
      const { state } = await import('./js/state.js');
      state.settings.theme = 'dark';
      state.settings.newsEnabled = true;
      document.documentElement.dataset.theme = 'dark';
      state.locale = 'GB';
      state.type = 'model';
      state.demo = {
        country: 'GB',
        type: 'model',
        createdAt: '2026-11-16T12:00:00Z',
        fields: {
          name: 'Amelia Whitaker',
          phone: '+447700900123',
          email: 'amelia.whitaker@dayrep.com',
          address: '12 Example Lane',
          city: 'London',
          postalCode: 'EC1A 1BB',
          handle: 'amelia.whitaker',
          bio: 'Portraits, natural light and everyday stories. 📷',
          categories: ['Model']
        },
        fieldOrder: [
          'name',
          'phone',
          'email',
          'address',
          'city',
          'postalCode',
          'handle',
          'bio',
          'categories'
        ]
      };
      state.bio = {
        parameters: { country: 'GB', city: 'London', postalCode: 'EC1A 1BB', type: 'model' }
      };
      state.bioParamsEditor = null;
      state.bioEditor = {
        flush: async () => {},
        freeze() {},
        release() {},
        dispose() {},
        values: {
          residence: 'London, United Kingdom',
          birthplace: 'Manchester, United Kingdom',
          employer: 'Synthetic Studio',
          employerCity: 'London',
          position: 'Fashion model',
          university: 'University College London',
          universityCity: 'London',
          school: 'Westminster School',
          schoolCity: 'London',
          mainBio: 'Portraits, natural light and everyday stories. 📷'
        },
        institutions: [
          {
            id: 'qa-university',
            kind: 'university',
            name: 'University College London',
            city: 'London'
          },
          { id: 'qa-school', kind: 'school', name: 'Westminster School', city: 'London' }
        ]
      };
      state.bioCities = [
        { city: 'London', postalCode: 'EC1A 1BB' },
        { city: 'Manchester', postalCode: 'M1 1AE' }
      ];
      state.news = {
        topic: 'fashion',
        updatedAt: '2026-11-16T12:00:00Z',
        items: Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          topic: 'fashion',
          title: [
            'A closer look at independent designers and the craft behind their latest collections',
            'Portrait photography: working with natural light',
            'How clothing repair workshops bring a neighbourhood together'
          ][i % 3],
          link: `https://example.test/news/${i}`,
          source: 'Synthetic publication',
          author: 'QA author',
          publishedAt: '2026-11-16T10:00:00Z'
        }))
      };
      window.tz12Render = async (view) => {
        state.view = view === 'news' ? 'news' : 'generator';
        state.generatorTab = view === 'bio' ? 'bio' : 'profile';
        const { viewHTML } = await import('./js/ui/views.js');
        document.getElementById('view').innerHTML = viewHTML();
        const heading = document.querySelector('.topbar .tb-title');
        if (heading) heading.textContent = view === 'news' ? 'News' : 'Generator';
        document
          .querySelectorAll('[data-view]')
          .forEach((item) => item.classList.toggle('active', item.dataset.view === state.view));
        document.getElementById('view').scrollTop = 0;
      };
    });
    for (const width of [360, 390, 480, 576, 768, 980, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const view of ['news', 'profile', 'bio']) {
        await page.evaluate((view) => window.tz12Render(view), view);
        await page.screenshot({
          path: path.join(out, `${label}-${view}-${width}.png`),
          animations: 'disabled'
        });
        metrics.push(
          await page.evaluate(
            ({ label, view, width }) => {
              const rect = (el) => {
                const r = el.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
              };
              return {
                label,
                view,
                width,
                overflow: document.documentElement.scrollWidth > innerWidth,
                cards: [...document.querySelectorAll('.news-item-card')].map(rect),
                controls: [...document.querySelectorAll('.ux-primary-controls .input')].map(rect)
              };
            },
            { label, view, width }
          )
        );
      }
    }
    fs.writeFileSync(
      path.join(out, `${label}-metrics.json`),
      JSON.stringify(metrics, null, 2) + '\n'
    );
  } finally {
    await app?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
