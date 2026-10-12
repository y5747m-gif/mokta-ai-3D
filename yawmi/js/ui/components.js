/* ============================================================
 * components.js — مكوّنات واجهة مشتركة (HTML)
 * ============================================================ */

import { esc } from './dom.js';
import { fmtTimeRange, fmtTime, fmtDur, pct, fmtTimeSpans, dayName, fmtDayRel } from '../core/format.js';
import { toMin, nowMin, todayISO, weekdayOf } from '../core/time.js';
import { EVENT_TYPES, ALARM_CATEGORIES } from '../data/defaults.js';

export function typeLabel(type) {
  const t = EVENT_TYPES[type] || EVENT_TYPES.custom;
  return t.ar;
}

export function typeIcon(type) {
  return (EVENT_TYPES[type] || EVENT_TYPES.custom).icon;
}

/** حلقة التقدم */
export function progressRing(percent, { label = 'مكتمل', size = 92 } = {}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
  return `
    <div class="progress-ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="8"/>
        <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="8"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <div class="ring-label"><b>${percent}%</b><small>${esc(label)}</small></div>
    </div>`;
}

/** بطاقة فعالية في الخط الزمني */
export function timelineItem(ev, { iso, status = null, nowMins = null, conflicts = new Set(), compact = false } = {}) {
  const nowM = nowMins ?? nowMin();
  const isNow = iso === todayISO() && toMin(ev.start) <= nowM && nowM < toMin(ev.end);
  const isDone = status === 'done';
  const isConflict = conflicts.has(ev.id);
  const classes = ['tl-item', 'ty-' + ev.type, isNow ? 'now' : '', isDone ? 'done' : '', isConflict ? 'conflict' : ''].filter(Boolean).join(' ');

  const chips = [];
  if (isNow) chips.push('<span class="chip chip-brand">الآن</span>');
  if (ev.isAlt) chips.push('<span class="chip chip-neutral">بديل</span>');
  if (ev.optional) chips.push('<span class="chip ' + (ev.confirmed ? 'chip-green' : 'chip-amber') + '">' + (ev.confirmed ? 'مؤكد' : 'غير مؤكد') + '</span>');
  if (ev.adjustable) chips.push('<span class="chip chip-purple">قابل للتعديل</span>');
  if (status === 'skipped') chips.push('<span class="chip chip-neutral">تم التخطي</span>');
  if (status === 'postponed') chips.push('<span class="chip chip-amber">مؤجّل</span>');
  if (isConflict) chips.push('<span class="chip chip-red">تعارض ⚠</span>');

  return `
    <div class="${classes}" data-event="${esc(ev.id)}" data-origin="${esc(ev.originId || ev.id)}">
      <div class="tl-time">${fmtTimeBareSafe(ev.start)}<br><span style="opacity:.6">${fmtTimeBareSafe(ev.end)}</span></div>
      <div class="tl-track">
        <div class="tl-dot"></div>
        <div class="tl-card" data-act="event-details" data-id="${esc(ev.id)}" role="button" tabindex="0">
          <h4>${typeIcon(ev.type)} ${esc(ev.title)} ${chips.join(' ')}</h4>
          <div class="tl-meta">
            <span>${fmtTimeRange(ev.start, ev.end)}</span>
            ${ev.subject ? `<span>• ${esc(ev.subjectName || '')}</span>` : ''}
            ${ev.notes && !compact ? `<span>• ${esc(ev.notes.slice(0, 60))}${ev.notes.length > 60 ? '…' : ''}</span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function fmtTimeBareSafe(hhmm) {
  return esc(hhmm);
}

/** شريط اختيار الأيام (ترتيب السبت → الجمعة) */
export function daySelector(selectedISO) {
  const today = todayISO();
  const baseWeekday = weekdayOf(selectedISO);
  // عرض نفس الأسبوع (سبت → جمعة) حول اليوم المحدد
  const order = [6, 0, 1, 2, 3, 4, 5];
  return `
    <div class="day-selector" role="tablist">
      ${order.map((d) => {
        const diff = (d - baseWeekday + 7) % 7;
        const back = diff > 3 ? diff - 7 : diff;
        const iso = shiftISO(selectedISO, back);
        const isToday = iso === today;
        return `
          <button type="button" class="day-pill ${isToday ? 'today' : ''} ${iso === selectedISO ? 'selected' : ''}"
            data-act="select-day" data-iso="${iso}" role="tab" aria-selected="${iso === selectedISO}">
            <small>${dayName(d, 'ar', true)}</small>
            <b>${iso.slice(8)}</b>
            ${isToday ? '<span class="dot"></span>' : ''}
          </button>`;
      }).join('')}
    </div>`;
}

function shiftISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** صف منبه */
export function alarmRow(a, nextAt = null) {
  const t = fmtTime(a.time);
  const cat = ALARM_CATEGORIES[a.category] || ALARM_CATEGORIES.custom;
  const daysText = a.repeat === 'daily' ? 'يوميًا'
    : a.repeat === 'once' ? (a.date || 'مرة واحدة')
    : (a.days || []).map((d) => dayName(d, 'ar', true)).join('، ');
  return `
    <div class="alarm-row ${a.enabled ? '' : 'off'}" data-alarm="${esc(a.id)}">
      <div class="alarm-time-big">${esc(t.split(' ')[0])}<small>${esc(t.split(' ').slice(1).join(' '))}</small></div>
      <div class="alarm-info" data-act="edit-alarm" data-id="${esc(a.id)}" role="button" tabindex="0">
        <h4>${cat.icon} ${esc(a.title)}</h4>
        <div class="meta">
          <span class="chip chip-neutral">${esc(daysText)}</span>
          ${a.sound !== 'none' ? '<span class="chip chip-blue">🔔 صوت</span>' : ''}
          ${a.vibrate ? '<span class="chip chip-purple">📳 اهتزاز</span>' : ''}
          ${nextAt ? `<span class="chip chip-amber">التالي: ${esc(nextAt)}</span>` : ''}
        </div>
      </div>
      <input type="checkbox" class="toggle" data-act="toggle-alarm" data-id="${esc(a.id)}" ${a.enabled ? 'checked' : ''} aria-label="تفعيل ${esc(a.title)}">
    </div>`;
}

/** صف مهمة */
export function taskRow(task, { subjectName = '' } = {}) {
  const overdue = task.status !== 'done' && task.dueAt && new Date(task.dueAt.replace(' ', 'T')) < new Date();
  return `
    <div class="task-row ${overdue ? 'overdue' : ''} ${task.status === 'done' ? 'done' : ''}" data-task="${esc(task.id)}">
      <button type="button" class="task-check ${task.status === 'done' ? 'checked' : ''}" data-act="toggle-task" data-id="${esc(task.id)}" aria-label="تبديل الإنجاز">
        ${task.status === 'done' ? '<svg viewBox="0 0 24 24" class="ic-sm"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>' : ''}
      </button>
      <div class="task-main" data-act="edit-task" data-id="${esc(task.id)}" role="button" tabindex="0">
        <h4><span class="priority-dot p-${esc(task.priority)}"></span> ${esc(task.title)}</h4>
        <div class="meta">
          ${subjectName ? `<span class="chip chip-brand">${esc(subjectName)}</span>` : ''}
          ${task.dueAt ? `<span class="chip ${overdue ? 'chip-red' : 'chip-amber'}">${overdue ? 'متأخرة — ' : ''}${esc(fmtDayRel(task.dueAt.slice(0, 10)))} ${esc(fmtTime(task.dueAt.slice(11)))}</span>` : '<span class="chip chip-neutral">بدون موعد</span>'}
          <span class="chip chip-neutral">⏱ ${fmtDur(task.estimatedMinutes)}</span>
          ${task.steps && task.steps.length ? `<span class="chip chip-blue">${task.steps.filter((s) => s.done).length}/${task.steps.length} خطوات</span>` : ''}
          ${task.recurring && task.recurring !== 'none' ? '<span class="chip chip-purple">🔁 متكررة</span>' : ''}
        </div>
      </div>
    </div>`;
}

/** بطاقة إحصاء */
export function statBox(value, label) {
  return `<div class="stat-box"><b>${esc(value)}</b><small>${esc(label)}</small></div>`;
}

/** مخطط أعمدة بسيط */
export function barChart(daily, { unit = 'د' } = {}) {
  const max = Math.max(60, ...daily.map((d) => d.minutes));
  return `
    <div class="bar-chart">
      ${daily.map((d) => `
        <div class="bar-col">
          <div class="bar-value">${d.minutes ? Math.round(d.minutes) : ''}</div>
          <div class="bar" style="height:${Math.max(3, (d.minutes / max) * 72)}px"></div>
          <div class="bar-label">${dayName(new Date(d.iso + 'T00:00:00').getDay(), 'ar', true)}</div>
        </div>`).join('')}
    </div>`;
}

export function notice(kind, text) {
  const icons = { info: 'ℹ️', warn: '⚠️', danger: '⛔', ok: '✅' };
  return `<div class="notice notice-${kind}"><span class="ic-sm">${icons[kind] || 'ℹ️'}</span><div>${text}</div></div>`;
}

export function emptyState(icon, title, text, actionHTML = '') {
  return `
    <div class="empty-state">
      <div class="ic-lg">${icon}</div>
      <h3>${esc(title)}</h3>
      <p class="muted">${esc(text)}</p>
      ${actionHTML}
    </div>`;
}

export function sectionHeader(title, actionHTML = '') {
  return `<div class="section-title"><h2>${esc(title)}</h2>${actionHTML}</div>`;
}

export { fmtTimeSpans };
