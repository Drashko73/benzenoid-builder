/**
 * Capture the README screenshots from a running dev server.
 *
 *     npm run dev            # in another terminal
 *     node scripts/screenshots.mjs [http://localhost:5173]
 *
 * Uses the locally installed Chrome/Edge through puppeteer-core, so nothing is
 * downloaded. Set BROWSER_PATH to point at a different executable.
 */
import { mkdirSync } from 'node:fs';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:5173';
const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found; set BROWSER_PATH.');
  process.exit(1);
}

const shots = [
  {
    name: 'editor-light',
    hash: '#c=0,1;0,2;1,1;2,0;2,1&n=perylene',
    theme: 'light',
    width: 1440,
    height: 900,
  },
  {
    name: 'editor-dark',
    hash: '#c=0,3;1,1;1,2;1,3;1,4;2,1;2,2;2,3;3,0;3,1;3,2;3,3;4,1&n=hbc',
    theme: 'dark',
    width: 1440,
    height: 900,
  },
  {
    name: 'validation',
    hash: '#c=1,0;0,1;-1,1;-1,0;0,-1;1,-1',
    theme: 'light',
    width: 1440,
    height: 900,
  },
];

mkdirSync('docs/screenshots', { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  for (const shot of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((theme) => {
      localStorage.setItem('benzenoid-builder.theme', theme);
    }, shot.theme);
    await page.goto(`${base}/${shot.hash}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('svg.honeycomb');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `docs/screenshots/${shot.name}.png` });
    console.log(`wrote docs/screenshots/${shot.name}.png`);
    await page.close();
  }
} finally {
  await browser.close();
}
