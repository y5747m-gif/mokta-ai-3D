/* ============================================================
 * study.js (screen) — مؤقت المذاكرة والتركيز + الإحصاءات
 * ============================================================ */

import { esc, openModal, collectForm, toast, field, selectField, textareaField } from '../dom.js';
import { statBox, barChart, notice, sectionHeader, emptyState, taskRow } from '../components.js';
import { state, putItem } from '../../core/store.js';
import { createTimer, logSession, studyStats, subjectBreakdown } from '../../features/study.js';
import { openTasks, createRevisionPlan, saveRevision, markRevisionDone, revisionDueOn, missedRevisions, createTask, saveTask } from '../../features/tasks.js';
import { fmtDur } from '../../core/format.js';
import { todayISO, fmtCountdownSec } from '../../core/time.js';
import { playSound, vibrate, ensureAudio } from '../../audio/tone.js';
import { navigate } from '../router.js';

let timer = null;
let timerInterval = null;
let lastPhaseEnd = null;

function getTimer() {
  if (!timer) {
    timer = createTimer(state.settings, {
      onTick(str) {
        const el = document.getElementById('timer-display');
        if (el) el.textContent = str;
        updatePhaseUI();
      },
      onPhaseEnd(phase, t) {
        lastPhaseEnd = { phase, at: Date.now() };
        if (phase === 'study') {
          showSessionEndModal(t);
        } else {
          toast('انتهت الاستراحة — لنكمل! 💪', 'ok');
        }
      },
      onState() { updatePhaseUI(); },
    });
  }
  return timer;
}

export function renderStudy() {
  const t = getTimer();
  const stats = studyStats();
  const breakdown = subjectBreakdown(7);
  const subjects = state.subjects.filter((s) => !s.archived);
  const open = openTasks().slice(0, 3);
  const dueRev = [...revisionDueOn(todayISO()), ...missedRevisions().map((m) => m.revision)].slice(0, 3);

  return {
    html: `
      <h1>المذاكرة والتركيز</h1>

      <!-- المؤقت -->
      <div class="card pad-lg text-center" id="timer-card">
        <div class="row" style="justify-content:center;gap:6px;margin-bottom:10px">
          <span class="chip ${t.phase === 'study' ? 'chip-blue' : t.phase === 'idle' ? 'chip-neutral' : 'chip-green'}" id="phase-chip">
            ${t.phase === 'study' ? '📚 جلسة مذاكرة' : t.phase === 'break' ? '☕ استراحة قصيرة' : t.phase === 'longBreak' ? '🌴 استراحة طويلة' : 'جاهز للبدء'}
          </span>
          ${t.completedSessions > 0 ? `<span class="chip chip-amber">${t.completedSessions} جلسات اليوم</span>` : ''}
        </div>
        <div id="timer-display" class="ltr" style="font-size:3.2rem;font-weight:800;letter-spacing:0.02em;font-variant-numeric:tabular-nums;color:var(--brand)">
          ${fmtCountdownSec((t.durationMin || state.settings.studyMinutes) * 60)}
        </div>
        <p class="muted small" id="timer-goal-label">${t.goal ? esc(t.goal) : 'اختر المادة والهدف ثم ابدأ'}</p>

        <div class="btn-row" style="justify-content:center" id="timer-controls">
          ${renderTimerButtons(t)}
        </div>
      </div>

      <!-- إعداد الجلسة -->
      <div class="card">
        <div class="card-title-row"><h2>إعداد الجلسة</h2></div>
        <form id="session-form">
          ${selectField('subject', 'المادة', [{ value: '', label: 'بدون مادة محددة' }, ...subjects.map((s) => ({ value: s.id, label: s.icon + ' ' + s.nameAr }))], t.subject || '')}
          ${field('goal', 'هدف الجلسة (ماذا تريد أن تنجز؟)', t.goal || '', { attrs: 'placeholder="مثال: إنهاء فصل 3 وحل أسئلته"' })}
          ${selectField('duration', 'مدة الجلسة', [
            { value: String(state.settings.studyMinutes), label: 'الافتراضية (' + state.settings.studyMinutes + ' دقيقة)' },
            { value: String(state.settings.shortSessionMinutes), label: 'قصيرة (' + state.settings.shortSessionMinutes + ' دقيقة) — وقت محدود' },
            { value: '90', label: 'عميقة (90 دقيقة)' },
          ], String(state.settings.studyMinutes))}
        </form>
        <div class="notice notice-info" style="margin-top:8px">
          <span class="ic-sm">⏱</span>
          <div>النمط: ${state.settings.studyMinutes} دقيقة مذاكرة + ${state.settings.breakMinutes} استراحة، واستراحة طويلة (${state.settings.longBreakMinutes} دقيقة) بعد كل ${state.settings.sessionsUntilLongBreak} جلسات.</div>
        </div>
      </div>

      <!-- الإحصاءات -->
      ${sectionHeader('إحصاءات المذاكرة')}
      <div class="card">
        <div class="stat-grid">
          ${statBox(fmtDur(stats.todayMinutes), 'اليوم')}
          ${statBox(fmtDur(stats.weekMinutes), 'آخر 7 أيام')}
          ${statBox(String(stats.weekSessions), 'جلسات الأسبوع')}
        </div>
        <div class="mt-2">${barChart(stats.daily)}</div>
        ${breakdown.length ? `
          <hr class="divider">
          <h3 class="small">حسب المادة</h3>
          ${breakdown.map((b) => {
            const s = state.subjects.find((x) => x.id === b.subject);
            return `<div class="row-between small" style="padding:3px 0"><span>${s ? s.icon + ' ' + esc(s.nameAr) : 'أخرى'}</span><span class="muted ltr">${fmtDur(b.minutes)}</span></div>`;
          }).join('')}
        ` : ''}
      </div>

      <!-- مهام ومقترحة -->
      ${sectionHeader('مقترح للمذاكرة الآن')}
      ${open.length ? open.map((task) => taskRow(task, { subjectName: task.subject ? (state.subjects.find((s) => s.id === task.subject)?.nameAr || '') : '' })).join('') : `
        <div class="card"><p class="muted small mb-0">لا توجد مهام مفتوحة. يمكنك البدء بمراجعة أي درس من جدول اليوم.</p></div>`}

      ${dueRev.length ? `
        ${sectionHeader('مراجعات متباعدة')}
        ${dueRev.map((r) => `
          <div class="card">
            <div class="row-between">
              <div>
                <strong>🔁 ${esc(r.title)}</strong>
                <div class="small muted">خطة مراجعة متباعدة — ${r.doneDates.length}/${r.dueDates.length} مكتملة</div>
              </div>
              <button class="btn btn-sm btn-success" data-act="rev-done" data-id="${esc(r.id)}">تمت</button>
            </div>
          </div>`).join('')}
      ` : ''}
    `,
    onMount(root) {
      wireStudy(root);
    },
  };
}

function renderTimerButtons(t) {
  if (t.phase === 'idle') {
    return `
      <button class="btn btn-primary" data-act="timer-start" style="min-width:160px">▶ ابدأ الجلسة</button>
      <button class="btn btn-ghost" data-act="timer-short">جلسة قصيرة</button>`;
  }
  return `
    ${t.paused
      ? '<button class="btn btn-primary" data-act="timer-resume">▶ استئناف</button>'
      : '<button class="btn btn-soft" data-act="timer-pause">⏸ إيقاف مؤقت</button>'}
    <button class="btn btn-ghost" data-act="timer-skip">تخطي المرحلة</button>
    <button class="btn btn-danger" data-act="timer-finish">إنهاء ✓</button>`;
}

function updatePhaseUI() {
  const t = getTimer();
  const chip = document.getElementById('phase-chip');
  if (chip) {
    chip.className = 'chip ' + (t.phase === 'study' ? 'chip-blue' : t.phase === 'idle' ? 'chip-neutral' : 'chip-green');
    chip.textContent = t.phase === 'study' ? '📚 جلسة مذاكرة' : t.phase === 'break' ? '☕ استراحة قصيرة' : t.phase === 'longBreak' ? '🌴 استراحة طويلة' : 'جاهز للبدء';
  }
  const controls = document.getElementById('timer-controls');
  if (controls) controls.innerHTML = renderTimerButtons(t);
}

function wireStudy(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const t = getTimer();
    const act = btn.dataset.act;

    if (act === 'timer-start' || act === 'timer-short') {
      ensureAudio();
      const form = root.querySelector('#session-form');
      const v = collectForm(form);
      const dur = act === 'timer-short'
        ? state.settings.shortSessionMinutes
        : (parseInt(v.duration, 10) || state.settings.studyMinutes);
      t.start(v.subject || null, v.goal || '', dur);
      startTicking();
      toast('بدأت الجلسة — ركّز، أنت تستطيع 💪', 'ok');
      return;
    }
    if (act === 'timer-pause') { t.pause(); return; }
    if (act === 'timer-resume') { ensureAudio(); t.resume(); return; }
    if (act === 'timer-skip') { t.skipPhase(); return; }
    if (act === 'timer-finish') {
      showSessionEndModal(t, true);
      return;
    }
    if (act === 'rev-done') {
      await markRevisionDone(btn.dataset.id);
      toast('أحسنت! مراجعة منجزة ✓', 'ok');
      return;
    }
  });
}

function startTicking() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const t = getTimer();
    if (t.phase === 'idle') {
      clearInterval(timerInterval);
      timerInterval = null;
      return;
    }
    const rem = t.remaining();
    const el = document.getElementById('timer-display');
    if (el) el.textContent = fmtCountdownSec(rem / 1000);
  }, 500);
}

/** نهاية الجلسة: أسئلة التقييم المطلوبة */
function showSessionEndModal(t, manual = false) {
  const durationMin = t.durationMin || state.settings.studyMinutes;
  const subjName = t.subject ? (state.subjects.find((s) => s.id === t.subject)?.nameAr || '') : '';
  openModal({
    title: manual ? 'إنهاء الجلسة' : 'انتهت جلسة المذاكرة 🎉',
    bodyHTML: `
      <p class="muted small">${subjName ? esc(subjName) + ' — ' : ''}${esc(t.goal || 'جلسة مذاكرة')} (${fmtDur(durationMin)})</p>
      <form id="reflect-form">
        ${selectField('finishedTask', 'هل أنجزت المطلوب؟', [
          { value: 'yes', label: 'نعم، أنهيت كل شيء ✓' },
          { value: 'partly', label: 'جزئيًا' },
          { value: 'no', label: 'لا، أحتاج وقتًا إضافيًا' },
        ], 'yes')}
        ${selectField('understanding', 'ما مدى فهمك للمادة؟', [
          { value: '5', label: 'ممتاز (5)' },
          { value: '4', label: 'جيد جدًا (4)' },
          { value: '3', label: 'متوسط (3)' },
          { value: '2', label: 'ضعيف (2)' },
          { value: '1', label: 'ضعيف جدًا (1)' },
        ], '4')}
        ${selectField('needAnother', 'هل تحتاج جلسة أخرى؟', [
          { value: 'no', label: 'لا، يكفي' },
          { value: 'yes', label: 'نعم، جلسة أخرى' },
          { value: 'later', label: 'لاحقًا' },
        ], 'no')}
        ${textareaField('reviewLater', 'ما الذي يجب مراجعته لاحقًا؟', '')}
      </form>
    `,
    actionsHTML: `<button class="btn btn-primary" data-save-reflection>حفظ وإنهاء</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-save-reflection]')) return;
        const v = collectForm(mroot.querySelector('#reflect-form'));
        await logSession({
          subject: t.subject,
          goal: t.goal,
          durationMin,
          startedAt: t.sessionStart || Date.now(),
          reflection: {
            finishedTask: v.finishedTask,
            understanding: parseInt(v.understanding, 10),
            needAnother: v.needAnother,
            reviewLater: v.reviewLater,
          },
        });
        // إذا طلب الطالب مراجعة لاحقة → اقتراح خطة مراجعة متباعدة
        if (v.reviewLater && v.reviewLater.trim()) {
          const plan = createRevisionPlan({
            title: v.reviewLater.trim(),
            subject: t.subject,
            learnedDate: todayISO(),
            intervals: state.settings.revisionIntervals,
          });
          await saveRevision(plan);
        }
        if (manual) t.reset();
        else {
          // الاستراحة تبدأ تلقائيًا بعد الجلسة
          startTicking();
        }
        close();
        toast('سُجّلت الجلسة. أحسنت! 🌟', 'ok');
        if (v.needAnother === 'yes') {
          navigate('#/study');
        }
      });
    },
  });
}
