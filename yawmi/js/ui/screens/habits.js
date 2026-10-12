/* ============================================================
 * habits.js — العادات اليومية + روتين النوم والصباح
 * ============================================================ */

import {
  esc, openModal, confirmDialog, collectForm, toast, field, selectField,
} from '../dom.js';
import { sectionHeader, notice, progressRing, statBox } from '../components.js';
import { state, putItem, saveSettings } from '../../core/store.js';
import {
  tickHabit, untickHabit, habitCount, habitDone, streakOf,
  habitsSummary, addHabit, removeHabit, encouragement,
} from '../../features/habits.js';
import {
  sleepEstimate, sleepReport, tomorrowPreview, checklistState,
  toggleChecklist, checklistProgress, DEFAULT_CHECKLIST,
} from '../../features/sleep.js';
import { todayISO, addDaysISO, toMin } from '../../core/time.js';
import { fmtTime, fmtDur, fmtDayRel, dayName } from '../../core/format.js';
import { eventsForDate } from '../../features/schedule.js';
import { navigate } from '../router.js';

/* ================= العادات ================= */

export function renderHabits() {
  const habits = state.habits.filter((h) => h.enabled !== false);
  const summary = habitsSummary();

  return {
    html: `
      <div class="row-between" style="margin-bottom:10px">
        <h1 style="margin:0">العادات اليومية</h1>
        <button class="btn btn-primary btn-sm" data-act="add-habit">+ عادة</button>
      </div>

      <div class="card pad-lg">
        <div class="ring-wrap">
          ${progressRing(summary.percent, { label: 'اليوم' })}
          <div style="flex:1">
            <h3 style="margin-bottom:4px">${esc(encouragement())}</h3>
            <p class="muted small mb-0">الاستمرار الهادئ أهم من الكمال. كل خطوة تُحتسب 🌱</p>
          </div>
        </div>
      </div>

      <div class="habit-grid">
        ${habits.map((h) => {
          const count = habitCount(h.id);
          const done = habitDone(h.id);
          const streak = streakOf(h.id);
          return `
            <div class="habit-card ${done ? 'done' : ''}">
              <div class="row-between">
                <div class="habit-ic">${h.icon || '⭐'}</div>
                ${streak > 0 ? `<span class="chip chip-amber">🔥 ${streak}</span>` : ''}
              </div>
              <h4>${esc(h.nameAr)}</h4>
              <div class="streak">${count}/${h.goal || 1} ${esc(h.unit || 'مرة')}${streak ? ' • ' + streak + ' يوم متتالي' : ''}</div>
              <button class="btn ${done ? 'btn-success' : 'btn-soft'}" data-act="tick-habit" data-id="${esc(h.id)}" ${done ? 'disabled' : ''}>
                ${done ? '✓ مكتملة' : '+ إنجاز'}
              </button>
              <button class="btn btn-sm btn-ghost" data-act="delete-habit" data-id="${esc(h.id)}">حذف</button>
            </div>`;
        }).join('')}
      </div>

      ${!habits.length ? '<div class="card"><p class="muted mb-0">لا توجد عادات بعد. أضف عادة واحدة صغيرة لتبدأ ✨</p></div>' : ''}
    `,
    onMount(root) {
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'tick-habit') {
          await tickHabit(btn.dataset.id);
          return;
        }
        if (act === 'add-habit') {
          openModal({
            title: 'عادة جديدة',
            bodyHTML: `
              <form id="habit-form">
                ${field('nameAr', 'اسم العادة', '', { required: true, attrs: 'placeholder="مثال: قراءة 10 صفحات"' })}
                ${field('icon', 'الرمز', '⭐', {})}
                ${field('goal', 'الهدف اليومي (عدد المرات)', '1', { type: 'number', attrs: 'min="1"' })}
              </form>`,
            actionsHTML: `<button class="btn btn-primary" data-save-habit>إضافة</button>`,
            onMount(mroot, close) {
              mroot.addEventListener('click', async (ev) => {
                if (!ev.target.closest('[data-save-habit]')) return;
                const v = collectForm(mroot.querySelector('#habit-form'));
                if (!v.nameAr.trim()) { toast('الاسم مطلوب', 'err'); return; }
                await addHabit({ nameAr: v.nameAr.trim(), icon: v.icon || '⭐', goal: parseInt(v.goal, 10) || 1 });
                close();
                toast('أُضيفت العادة ✓', 'ok');
              });
            },
          });
        }
        if (act === 'delete-habit') {
          const ok = await confirmDialog({ title: 'حذف العادة', message: 'سيتم حذف العادة وسجلها. متأكد؟', okText: 'حذف', danger: true });
          if (ok) {
            await removeHabit(btn.dataset.id);
            toast('تم الحذف', 'ok');
          }
        }
      });
    },
  };
}

/* ================= روتين النوم ================= */

export function renderSleep() {
  const s = state.settings;
  const est = sleepEstimate(s);
  const report = sleepReport(state.events);
  const tomorrow = tomorrowPreview(state.events);
  const chk = checklistProgress();

  return {
    html: `
      <h1>روتين النوم والصباح</h1>

      <div class="card pad-lg">
        <div class="ring-wrap">
          ${progressRing(chk.percent, { label: 'التجهيز', size: 84 })}
          <div style="flex:1">
            <h3 style="margin-bottom:2px">قائمة تجهيز الغد 🎒</h3>
            <p class="muted small mb-0">التجهيز المسبق يمنح صباحًا هادئًا وإيقاظًا أسهل.</p>
          </div>
        </div>
        <div class="mt-1">
          ${DEFAULT_CHECKLIST.map((c) => `
            <div class="check-row">
              <input type="checkbox" id="chk-${c.key}" data-act="toggle-chk" data-key="${c.key}" ${checklistState(c.key) ? 'checked' : ''}>
              <label for="chk-${c.key}">${c.icon} ${esc(c.label)}</label>
            </div>`).join('')}
        </div>
      </div>

      ${report.warnings.length ? notice('warn', report.warnings.map(esc).join('<br>')) : notice('ok', 'مدة النوم المخططة: ' + est.text + ' — ضمن المدى الصحي 👍')}

      <div class="card">
        <div class="card-title-row"><h2>أوقات النوم</h2><button class="btn btn-sm btn-soft" data-act="edit-sleep-times">تعديل</button></div>
        <div class="list-row"><div class="lr-main"><strong>🌙 بداية الاسترخاء</strong></div><div class="lr-side">${fmtTime(s.windDownTime)}</div></div>
        <div class="list-row"><div class="lr-main"><strong>🛏️ ميعاد النوم</strong></div><div class="lr-side">${fmtTime(s.bedTime)}</div></div>
        <div class="list-row"><div class="lr-main"><strong>⏳ آخر موعد مسموح</strong></div><div class="lr-side">${fmtTime(s.latestBedTime)}</div></div>
        <div class="list-row"><div class="lr-main"><strong>⏰ الاستيقاظ</strong></div><div class="lr-side">${fmtTime(s.wakeTime)}</div></div>
        <div class="list-row"><div class="lr-main"><strong>⏱️ تقدير النوم</strong></div><div class="lr-side">${est.text}</div></div>
      </div>

      ${sectionHeader('جدول الغد — ' + fmtDayRel(tomorrow.iso))}
      <div class="card">
        ${tomorrow.lessons.length ? tomorrow.lessons.map((l) => `
          <div class="row-between small" style="padding:5px 0">
            <span>🕌 ${esc(l.title)}</span>
            <span class="muted ltr">${l.start}–${l.end}</span>
          </div>`).join('')
        : '<p class="muted small mb-0">لا دروس غدًا — يوم مذاكرة مفتوح.</p>'}
        <hr class="divider">
        <div class="small muted">إجمالي فعاليات الغد: ${tomorrow.items.length} • ${dayName(new Date(tomorrow.iso + 'T00:00:00').getDay())}</div>
      </div>

      <div class="card">
        <div class="card-title-row"><h2>منبهات الروتين</h2></div>
        <p class="small muted">منبه الاستيقاظ (${fmtTime(s.wakeTime)}) وتذكير الاستعداد للنوم (${fmtTime(s.windDownTime)}) مفعّلان افتراضيًا في صفحة المنبهات.</p>
        <button class="btn btn-soft btn-block btn-sm" data-act="go-alarms">إدارة المنبهات</button>
      </div>
    `,
    onMount(root) {
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'toggle-chk') {
          await toggleChecklist(btn.dataset.key);
          return;
        }
        if (act === 'go-alarms') { navigate('#/alarms'); return; }
        if (act === 'edit-sleep-times') {
          openModal({
            title: 'تعديل أوقات النوم',
            bodyHTML: `
              <form id="sleep-form">
                ${field('wakeTime', 'وقت الاستيقاظ', s.wakeTime, { type: 'time' })}
                ${field('windDownTime', 'بدء الاسترخاء', s.windDownTime, { type: 'time' })}
                ${field('bedTime', 'ميعاد النوم', s.bedTime, { type: 'time' })}
                ${field('latestBedTime', 'آخر موعد مسموح للنوم', s.latestBedTime, { type: 'time' })}
              </form>`,
            actionsHTML: `<button class="btn btn-primary" data-save-sleep>حفظ</button>`,
            onMount(mroot, close) {
              mroot.addEventListener('click', async (ev) => {
                if (!ev.target.closest('[data-save-sleep]')) return;
                const v = collectForm(mroot.querySelector('#sleep-form'));
                await saveSettings({
                  wakeTime: v.wakeTime, windDownTime: v.windDownTime,
                  bedTime: v.bedTime, latestBedTime: v.latestBedTime,
                });
                close();
                toast('تم الحفظ ✓', 'ok');
              });
            },
          });
        }
      });
      // القوائم: checkbox change
      root.addEventListener('change', async (e) => {
        const chk = e.target.closest('[data-act="toggle-chk"]');
        if (chk) {
          await toggleChecklist(chk.dataset.key);
          import('../router.js').then((r) => r.requestRender());
        }
      });
    },
  };
}
