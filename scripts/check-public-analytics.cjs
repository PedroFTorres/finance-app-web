// Isolated browser check: all network requests are intercepted, including Google.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const runtime = '/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = createRequire(path.join(runtime, 'playwright/package.json'))('playwright');
const root = path.resolve(__dirname, '..');
const key = 'arolix-public-analytics-v1';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  const requests = [], errors = [];
  try {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      requests.push(url.href);
      if (url.hostname === 'www.googletagmanager.com') {
        return route.fulfill({ contentType: 'text/javascript', body: 'document.cookie="_ga=test;path=/;SameSite=Lax;Secure";document.cookie="_ga_YCEFKJH08Z=test;path=/;SameSite=Lax;Secure";' });
      }
      if (!['arolix.com.br', '127.0.0.1'].includes(url.hostname)) throw new Error('Unexpected external request: ' + url.origin);
      const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ contentType: mime, body: fs.readFileSync(file) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const googleCount = () => requests.filter(url => url.includes('googletagmanager.com')).length;
    await page.goto('https://arolix.com.br/?email=secret@example.test#access_token=secret');
    await page.locator('.analytics-consent').waitFor();
    assert.equal(googleCount(), 0);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow at ' + width);
      assert.equal(await page.getByRole('button', { name: 'Recusar', exact: true }).isVisible(), true);
      assert.ok(await page.locator('.analytics-consent-actions button').evaluateAll(buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        return y < innerHeight && button.contains(document.elementFromPoint(x, y));
      })), 'Consent buttons must be unobscured at ' + width);
    }
    await page.screenshot({ path: '/private/tmp/arolix-analytics-consent-320.png' });
    await page.getByRole('button', { name: 'Recusar', exact: true }).click();
    await page.reload();
    assert.equal(googleCount(), 0);
    assert.equal(await page.locator('.analytics-consent').isVisible(), false);
    await page.getByRole('button', { name: 'Preferências de privacidade', exact: true }).click();
    await page.getByRole('button', { name: 'Aceitar estatísticas', exact: true }).click();
    await page.waitForFunction(() => document.cookie.includes('_ga='));
    assert.equal(googleCount(), 1);
    const queue = await page.evaluate(() => window.dataLayer.map(item => Array.from(item)));
    const global = queue.find(item => item[0] === 'set')[1];
    assert.equal(global.page_location, 'https://arolix.com.br/');
    assert.equal(global.page_referrer, '');
    assert.equal(global.allow_google_signals, false);
    assert.equal(queue.filter(item => item[0] === 'event' && item[1] === 'page_view').length, 1);
    assert.ok(!JSON.stringify(queue).includes('secret'));
    // Prevent navigation to inspect the CTA event; do not access any login flow.
    await page.evaluate(() => document.addEventListener('click', event => event.preventDefault()));
    await page.locator('a[href="login.html"]').first().click();
    assert.ok(await page.evaluate(() => window.dataLayer.some(item => item[0] === 'event' && item[1] === 'public_cta_click' && item[2].action === 'open_login')));
    await page.reload();
    assert.equal(googleCount(), 2, 'Remembered acceptance loads once per page');
    await page.getByRole('button', { name: 'Preferências de privacidade', exact: true }).click();
    await page.getByRole('button', { name: 'Recusar', exact: true }).click();
    await page.waitForFunction(() => !document.cookie.includes('_ga=') && !window.dataLayer);
    assert.equal(googleCount(), 2, 'Withdrawal must not reload Google');
    assert.equal((await context.cookies()).filter(cookie => cookie.name.startsWith('_ga')).length, 0);
    await page.evaluate(storageKey => localStorage.setItem(storageKey, JSON.stringify({ value: 'accepted', at: Date.now() - 181 * 86400000 })), key);
    await page.reload();
    assert.equal(googleCount(), 2);
    assert.equal(await page.locator('.analytics-consent').isVisible(), true, 'Expired choice needs consent again');
    await page.evaluate(storageKey => localStorage.setItem(storageKey, JSON.stringify({ value: 'accepted', at: Date.now() })), key);
    // Defense in depth: even when mistakenly injected on a private URL, it exits.
    await page.goto('https://arolix.com.br/privacidade-estatisticas.html');
    await page.evaluate(() => history.replaceState(null, '', '/app.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'public-analytics.js'), 'utf8') });
    assert.equal(googleCount(), 2);
    assert.equal(await page.locator('.analytics-consent').count(), 0);
    await page.goto('https://arolix.com.br/como-controlar-compras-parceladas.html?email=secret', { referer: 'https://example.test/private/secret?token=secret' });
    assert.equal(googleCount(), 3);
    const referred = await page.evaluate(() => window.dataLayer.find(item => item[0] === 'set')[1]);
    assert.equal(referred.page_referrer, 'https://example.test/');
    assert.equal(referred.page_location, 'https://arolix.com.br/como-controlar-compras-parceladas.html');
    assert.ok(!JSON.stringify(referred).includes('secret'));
    await page.goto('https://arolix.com.br/como-organizar-contas-do-mes.html?email=secret#secret');
    assert.equal(googleCount(), 4);
    const monthly=await page.evaluate(()=>window.dataLayer.find(item=>item[0]==='set')[1]);
    assert.equal(monthly.page_location,'https://arolix.com.br/como-organizar-contas-do-mes.html');
    assert.equal(monthly.page_title,'Como organizar as contas do mês | Arolix');
    assert.ok(!JSON.stringify(monthly).includes('secret'));
    await page.goto('https://arolix.com.br/como-controlar-gastos-por-categoria.html?email=secret#secret');
    assert.equal(googleCount(), 5);
    const categories=await page.evaluate(()=>window.dataLayer.find(item=>item[0]==='set')[1]);
    assert.equal(categories.page_location,'https://arolix.com.br/como-controlar-gastos-por-categoria.html');
    assert.equal(categories.page_title,'Como controlar gastos por categoria | Arolix');
    assert.ok(!JSON.stringify(categories).includes('secret'));
    await page.goto('http://127.0.0.1:8766/');
    assert.equal(googleCount(), 5, 'Local preview must never contaminate real metrics');
    assert.equal(await page.locator('.analytics-consent').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Analytics: no requests before consent or after refusal; remembered acceptance; sanitized page URL; CTA semantics; withdrawal + cookie removal; expiry; private/local guards; four widths OK. All Google calls mocked.');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
