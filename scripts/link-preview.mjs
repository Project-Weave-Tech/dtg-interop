// Renders the link preview (og:image) from the built data, so it shows today's projects
// and the pairs that have run together. Run after `npm run build`.
//
// Fills design/link-preview.html with the projects of site/dist/data.json and the pairs of
// every run that did not fail, places partners across the ring, renders it with headless
// Chrome and writes site/dist/board-preview.png. When there is no Chrome or rendering
// fails, site/dist keeps the committed site/board-preview.png and the build goes on.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const dist = join(root, 'site', 'dist');
const data = JSON.parse(readFileSync(join(dist, 'data.json'), 'utf8'));

const projects = (data.projects || []).map((p) => [p.slug, p.logo || '']);
const slugs = new Set(projects.map(([s]) => s));

// Every pair of different projects in a run that did not fail, each pair once
const seen = new Set();
const played = [];
for (const r of data.runs || []) {
  if (r.outcome === 'fail') continue;
  const sides = [...new Set((r.sides || []).map((x) => x.project))].filter((s) => slugs.has(s)).sort();
  for (let a = 0; a < sides.length; a++) for (let b = a + 1; b < sides.length; b++) {
    const key = sides[a] + '|' + sides[b];
    if (!seen.has(key)) { seen.add(key); played.push([sides[a], sides[b]]); }
  }
}

// Ring order: partners across the ring so their lines cross it; everyone else in data order
const n = projects.length;
const slot = new Array(n).fill(null);
const placed = new Map();
const half = Math.floor(n / 2);
const free = (i) => slot[i] === null;
const nearestFree = (i) => { for (let d = 0; d < n; d++) for (const j of [(i + d) % n, (i - d + n) % n]) if (free(j)) return j; return -1; };
const put = (s, i) => { slot[i] = s; placed.set(s, i); };
let start = 0;
for (const [a, b] of played) {
  if (placed.has(a) && placed.has(b)) continue;
  if (placed.has(a) || placed.has(b)) {
    const [x, y] = placed.has(a) ? [a, b] : [b, a];
    put(y, nearestFree((placed.get(x) + half) % n));
    continue;
  }
  let i = -1;
  for (let k = 0; k < n && i < 0; k++) { const c = (start + 3 * k) % n; if (free(c) && free((c + half) % n)) i = c; }
  if (i < 0) i = nearestFree(start);
  put(a, i);
  put(b, nearestFree((i + half) % n));
  start = (i + 3) % n;
}
for (const [s] of projects) if (!placed.has(s)) put(s, nearestFree(0));
const ring = slot.map((s) => projects.find(([x]) => x === s));

// The filled template sits in site/dist for the render, so relative logo paths resolve
const template = readFileSync(join(root, 'design', 'link-preview.html'), 'utf8');
const page = join(dist, '_link-preview.html');
const inject = `<script>window.PREVIEW = ${JSON.stringify({ projects: ring, played })};</script>\n`;
writeFileSync(page, template.replace('<script>', inject + '<script>'));

const chrome = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .filter(Boolean).find((c) => { try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return existsSync(c); } });
const out = join(dist, 'board-preview.png');
try {
  if (!chrome) throw new Error('no Chrome or Chromium found');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=10000', '--window-size=1200,630', `--screenshot=${out}`, `file://${page}`],
    { stdio: 'ignore', timeout: 90_000 });
  console.log(`link preview: ${n} project(s), ${played.length} pair(s) that ran → site/dist/board-preview.png`);
} catch (e) {
  console.warn(`link preview: kept the committed image (${e.message})`);
} finally {
  rmSync(page, { force: true });
}
