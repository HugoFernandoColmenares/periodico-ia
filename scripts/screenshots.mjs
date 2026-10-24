// Capturas de la portada en escritorio (1280px) y móvil (390px), del suplemento y de Opciones.
// Uso: `npm run screenshots` o `npm run screenshots -- opciones` para generar solo las que contengan ese texto.
// Uso: con el servidor corriendo (npm start), ejecuta `npm run screenshots`.
// Requiere Chrome/Chromium instalado (o define CHROME_PATH).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const shots = [
  { name: 'portada-escritorio.png', viewport: { width: 1280, height: 900 }, fullPage: true },
  { name: 'portada-movil.png', viewport: { width: 390, height: 844 }, fullPage: true, mobile: true },
  { name: 'aprender-escritorio.png', viewport: { width: 1280, height: 900 }, fullPage: false, click: 'Qué aprender' },
  { name: 'opciones-escritorio.png', viewport: { width: 1280, height: 900 }, fullPage: true, click: 'Opciones', wait: '.options__next' },
  { name: 'opciones-movil.png', viewport: { width: 390, height: 844 }, fullPage: true, mobile: true, click: 'Opciones', wait: '.options__next' },
];
const only = process.argv[2];
for (const s of shots.filter((x) => !only || x.name.includes(only))) {
  const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: !!s.mobile, hasTouch: !!s.mobile, locale: 'es-CO' });
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('app-article-card');
  if (s.click) {
    await page.getByRole('link', { name: s.click }).first().click();
    await page.waitForSelector(s.wait ?? '.learning__topic');
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + s.name, fullPage: s.fullPage });
  console.log('✔', OUT + s.name);
  await ctx.close();
}
await browser.close();
