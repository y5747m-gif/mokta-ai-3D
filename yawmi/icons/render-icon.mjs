#!/usr/bin/env node
/* ============================================================
 * render-icon.mjs — توليد أيقونات PWA لتطبيق "يومي | YAWMI"
 * يرسم الأيقونة برمجيًا (SDF + supersampling) ثم يحوّلها إلى PNG
 * عبر ImageMagick. قابلة لإعادة الإنتاج: node icons/render-icon.mjs
 * ============================================================
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const NAVY_A = hex('#16335F');
const NAVY_B = hex('#0C1F42');
const AMBER_A = hex('#F5A623');
const AMBER_B = hex('#FFD37A');
const WHITE = [255, 255, 255];

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* مسافات موقّعة للأشكال (SDF) */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}
function sdSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}
function sdPolyline(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, sdSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

/* الأيقونة على مسرح 512×512 */
function shade(x, y, { maskable }) {
  // خلفية متدرجة كحلي
  const tGrad = clamp((x * 0.4 + y * 0.6) / 512, 0, 1);
  let base = mix(NAVY_A, NAVY_B, tGrad);
  let out = base;

  // زوايا دائرية (ما عدا النسخة القابلة للقناع)
  if (!maskable) {
    const dCorner = sdRoundRect(x, y, 256, 256, 256, 256, 112);
    if (dCorner > 1.5) return null; // شفاف خارج الزوايا
    if (dCorner > -1.5) {
      // حواف ناعمة: مزج مع الشفافية عبر نسبة التغطية
      const cover = clamp(0.5 - dCorner, 0, 1);
      return { rgb: out, alpha: cover };
    }
  }

  const cover = (d, soft = 1.5) => clamp(0.5 - d / soft, 0, 1);

  // الشمس الدائرية بتدرّج كهرماني
  const dSun = sdCircle(x, y, 256, 216, 78);
  if (dSun < 2) {
    const tSun = clamp((216 + 78 - y) / 156, 0, 1);
    const sun = mix(AMBER_A, AMBER_B, tSun);
    out = mix(out, sun, cover(dSun));
  }

  // أشعة الشمس
  const rays = [
    [256, 84, 256, 112],
    [152, 112, 172, 132],
    [360, 112, 340, 132],
    [118, 216, 146, 216],
    [394, 216, 366, 216],
  ];
  for (const [x1, y1, x2, y2] of rays) {
    const d = sdSegment(x, y, x1, y1, x2, y2) - 9; // نصف السماكة 18/2
    if (d < 2) out = mix(out, AMBER_B, cover(d));
  }

  // شريط "المهام" الأبيض الشفاف
  const dBar = sdRoundRect(x, y, 256, 341, 136, 11, 11);
  if (dBar < 2) out = mix(out, WHITE, cover(dBar) * 0.35);

  // علامة الصح البيضاء
  const dCheck = sdPolyline(x, y, [[158, 392], [232, 452], [366, 322]]) - 18;
  if (dCheck < 2) out = mix(out, WHITE, cover(dCheck));

  return { rgb: out, alpha: 1 };
}

function renderIcon(size, { maskable = false } = {}) {
  const ss = 3; // عيّنات فوقية
  const W = size * ss;
  const buf = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = ((x * ss + sx) + 0.5) * (512 / W);
          const py = ((y * ss + sy) + 0.5) * (512 / W);
          const s = shade(px, py, { maskable });
          if (!s) continue;
          r += s.rgb[0] * s.alpha; g += s.rgb[1] * s.alpha; b += s.rgb[2] * s.alpha; a += s.alpha;
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 3;
      if (a <= 0) { buf[i] = 12; buf[i + 1] = 31; buf[i + 2] = 66; continue; }
      // مزج فوق خلفية داكنة ثابتة لضمان PNG معتّم متوافق
      const bg = [12, 31, 66];
      buf[i] = clamp(Math.round(r / a * (a / n) + bg[0] * (1 - a / n)), 0, 255);
      buf[i + 1] = clamp(Math.round(g / a * (a / n) + bg[1] * (1 - a / n)), 0, 255);
      buf[i + 2] = clamp(Math.round(b / a * (a / n) + bg[2] * (1 - a / n)), 0, 255);
    }
  }
  return buf;
}

function writePng(size, opts, outName) {
  const raw = join(__dir, `_tmp-${size}-${opts.maskable ? 'm' : 'n'}.raw`);
  writeFileSync(raw, renderIcon(size, opts));
  execFileSync('convert', ['-size', `${size}x${size}`, '-depth', '8', `rgb:${raw}`, join(__dir, outName)]);
  rmSync(raw);
  console.log('✔', outName);
}

writePng(192, {}, 'icon-192.png');
writePng(512, {}, 'icon-512.png');
writePng(96, {}, 'icon-96.png');
writePng(512, { maskable: true }, 'icon-maskable-512.png');
writePng(180, {}, 'apple-touch-icon.png');
