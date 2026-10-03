const { chromium } = require('/Users/leo/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const fs = require('fs');

const BASE = 'http://127.0.0.1:5173/';
const OUT = '/Users/leo/WorkBuddy/疗愈/outputs/verify';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const screens = ['loading','question','audio','intro','home','practice','done','profile','body'];
const ts = Date.now();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 470, height: 836 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  for (const s of screens) {
    await page.goto(BASE + '?screen=' + s, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const file = `${OUT}/${s}-${ts}.png`;
    await page.screenshot({ path: file });
    console.log('shot', s, '->', file);
  }
  // overflow check across widths
  for (const w of [320, 375, 470, 768]) {
    await page.setViewportSize({ width: w, height: 836 });
    await page.goto(BASE + '?screen=home', { waitUntil: 'networkidle' });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log('overflow@' + w, ov);
  }
  console.log('console-errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
