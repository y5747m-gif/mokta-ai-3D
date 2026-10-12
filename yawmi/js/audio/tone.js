/* ============================================================
 * tone.js — أصوات المنبه والتغذية الراجعة (Web Audio API)
 * يعمل دون إنترنت — لا ملفات صوت خارجية.
 * ============================================================ */

let ctx = null;
let activeNodes = [];
let loopTimer = null;

export function ensureAudio() {
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return null;
  if (!ctx) {
    const AC = typeof AudioContext !== 'undefined' ? AudioContext : webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, startAt, dur, { type = 'sine', gain = 0.22, slideTo = null } = {}) {
  const c = ensureAudio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startAt + dur);
  g.gain.setValueAtTime(0.0001, startAt);
  g.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(g).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
  activeNodes.push(osc);
  osc.onended = () => { activeNodes = activeNodes.filter((n) => n !== osc); };
}

/** نمط صوتي واحد */
function playPattern(name) {
  const c = ensureAudio();
  if (!c) return;
  const t0 = c.currentTime;
  if (name === 'gentle') {
    tone(523.25, t0, 0.45, { type: 'sine', gain: 0.18 });
    tone(659.25, t0 + 0.35, 0.55, { type: 'sine', gain: 0.16 });
  } else if (name === 'chime') {
    tone(880, t0, 0.35, { type: 'triangle', gain: 0.16 });
    tone(1174.66, t0 + 0.22, 0.5, { type: 'triangle', gain: 0.13 });
  } else if (name === 'urgent') {
    for (let i = 0; i < 3; i++) {
      tone(740, t0 + i * 0.42, 0.3, { type: 'square', gain: 0.12 });
      tone(540, t0 + i * 0.42 + 0.15, 0.25, { type: 'square', gain: 0.1 });
    }
  } else if (name === 'classic') {
    for (let i = 0; i < 4; i++) {
      tone(1046.5, t0 + i * 0.28, 0.22, { type: 'square', gain: 0.1, slideTo: 660 });
    }
  } else if (name === 'tick') {
    tone(1200, t0, 0.05, { type: 'triangle', gain: 0.08 });
  } else if (name === 'done') {
    tone(523, t0, 0.18, { type: 'sine', gain: 0.16 });
    tone(659, t0 + 0.12, 0.18, { type: 'sine', gain: 0.16 });
    tone(784, t0 + 0.24, 0.32, { type: 'sine', gain: 0.18 });
  } else if (name === 'break') {
    tone(392, t0, 0.3, { type: 'triangle', gain: 0.14 });
    tone(494, t0 + 0.25, 0.45, { type: 'triangle', gain: 0.13 });
  }
}

/** تشغيل صوت واحد */
export function playSound(name = 'gentle') {
  if (!name || name === 'none') return;
  ensureAudio();
  playPattern(name);
}

/** تشغيل صوت المنبه مع تكرار (الحلقة تستمر حتى الإيقاف) */
export function startAlarmSound(name = 'gentle') {
  stopAll();
  if (!name || name === 'none') return;
  ensureAudio();
  playPattern(name);
  loopTimer = setInterval(() => playPattern(name), 2600);
}

export function stopAll() {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  for (const n of activeNodes) {
    try { n.stop(); } catch { /* تم إيقافه بالفعل */ }
  }
  activeNodes = [];
}

/** اهتزاز الجهاز */
export function vibrate(pattern = [120, 80, 120]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* غير مدعوم */ }
  }
}

export function startAlarmVibration() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const pattern = [200, 100, 200, 100, 400];
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
  return setInterval(() => {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }, 3000);
}

export function stopVibration(handle) {
  if (handle) clearInterval(handle);
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(0); } catch { /* ignore */ }
  }
}
