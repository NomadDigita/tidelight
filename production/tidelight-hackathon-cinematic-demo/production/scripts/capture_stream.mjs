import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.env.PRODUCTION_DIR || path.join(scriptsDir, '..', 'capture'));
const out = path.join(outDir, 'public_desktop_capture.mp4');
const baseUrl = (process.env.TIDELIGHT_BASE_URL || 'https://tidelight.app').replace(/\/$/, '');
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '3', '-vcodec', 'mjpeg', '-i', 'pipe:0', '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
async function scene(route, seconds, clickText) {
  console.log('route', route);
  await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1600);
  if (clickText) {
    const el = page.getByText(clickText, { exact: true }).first();
    if (await el.count()) await el.click({ timeout: 2500 }).catch(() => {});
  }
  const end = Date.now() + seconds * 1000;
  let count = 0;
  while (Date.now() < end) {
    const buf = await page.screenshot({ type: 'jpeg', quality: 84 });
    if (!ff.stdin.write(buf)) await new Promise(resolve => ff.stdin.once('drain', resolve));
    count++;
    await page.waitForTimeout(200);
  }
  console.log(route, count, 'frames');
}
await scene('/', 8);
await scene('/markets', 24, 'rTokens');
await scene('/research', 18);
await scene('/flow', 22);
await scene('/strategies', 24);
await scene('/nightwatch', 24);
ff.stdin.end();
await new Promise((resolve, reject) => { ff.once('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))); });
await browser.close();
console.log('saved', out);
