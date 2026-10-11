import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.env.PRODUCTION_DIR || path.join(scriptsDir, '..', 'capture', 'raw'));
const baseUrl = (process.env.TIDELIGHT_BASE_URL || 'https://tidelight.app').replace(/\/$/, '');
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } } });
const page = await context.newPage();
page.setDefaultNavigationTimeout(45000);
for (const [route, hold] of [['/', 2500], ['/markets', 3500], ['/research', 3500], ['/flow', 3500], ['/strategies', 3500], ['/nightwatch', 3500]]) {
  console.log('opening', route);
  await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.mouse.move(1120, 500);
  await page.waitForTimeout(hold);
}
await context.close();
await browser.close();
console.log('video files saved in', outDir);
