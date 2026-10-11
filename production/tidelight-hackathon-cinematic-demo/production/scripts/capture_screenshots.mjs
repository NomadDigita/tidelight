import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.PRODUCTION_DIR || path.join(scriptsDir, '..', 'capture'));
const baseUrl = (process.env.TIDELIGHT_BASE_URL || 'https://tidelight.app').replace(/\/$/, '');
await fs.mkdir(path.join(out, 'screens'), { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await context.newPage();
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 90000 });
await page.screenshot({ path: path.join(out, 'screens', 'landing.png') });
for (const [route, name] of [['/markets', 'markets'], ['/research', 'research'], ['/flow', 'flow'], ['/strategies', 'strategies'], ['/nightwatch', 'nightwatch']]) {
  await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
  await page.mouse.move(1650, 880);
  await page.waitForTimeout(1700);
}
for (const [route, name, scroll] of [['/strategies', 'strategies-detail', 580], ['/nightwatch', 'nightwatch-detail', 650]]) {
  await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.mouse.wheel(0, scroll);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(out, 'screens', `${name}.png`) });
}
await context.close();
await browser.close();
