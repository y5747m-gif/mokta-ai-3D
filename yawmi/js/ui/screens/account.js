/* ============================================================
 * account.js — حسابي: الملف الشخصي + إدارة المهام (الواجبات)
 * ============================================================ */

import {
  esc, openModal, confirmDialog, collectForm, toast, field, selectField,
  textareaField, toggleRow,
} from '../dom.js';
import { taskRow, notice, sectionHeader, emptyState, statBox } from '../components.js';
import { state, putItem, deleteItem, subjectById } from '../../core/store.js';
import {
  openTasks, overdueTasks, completeTask, reopenTask, removeTask,
  createTask, saveTask, taskSummary, toggleStep, revisionDueOn, missedRevisions,
  createRevisionPlan, saveRevision, markRevisionDone,
} from '../../features/tasks.js';
import { todayISO, addDaysISO } from '../../core/time.js';
import { fmtDate, fmtDayRel, fmtDur, fmtRel } from '../../core/format.js';
import { navigate } from '../router.js';

/* ================= الملف الشخصي + البطاقات ================= */

export function renderAccount() {
  const p = state.settings.profile || {};
  const sum = taskSummary();
  const profile = `
    <div class="hero-greeting" style="background:linear-gradient(135deg,var(--brand),var(--navy-600))">
      <h1>${esc(p.name || 'الطالب')} 🎓</h1>
      <div class="hero-date">${esc(p.grade || '')} • ${esc(p.system || '')} • ${esc(p.section || '')}</div>
    </div>

    <div class="quick-grid" style="grid-template-columns:repeat(2,1fr)">
      <button class="quick-action" data-act="nav" data-href="#/account/tasks">
        <span style="font-size:22px">📝</span> المهام والواجبات
        ${sum.open ? `<span class="chip chip-amber">${sum.open} مفتوحة</span>` : ''}
      </button>
      <button class="quick-action" data-act="nav" data-href="#/account/subjects">
        <span style="font-size:22px">📚</span> المواد الدراسية
      </button>
      <button class="quick-action" data-act="nav" data-href="#/account/habits">
        <span style="font-size:22px">🌱</span> العادات اليومية
      </button>
      <button class="quick-action" data-act="nav" data-href="#/account/sleep">
        <span style="font-size:22px">🌙</span> روتين النوم
      </button>
      <button class="quick-action" data-act="nav" data-href="#/account/settings">
        <span style="font-size:22px">⚙️</span> الإعدادات
      </button>
      <button class="quick-action" data-act="nav" data-href="#/notifications">
        <span style="font-size:22px">🔔</span> مركز الإشعارات
      </button>
    </div>

    ${sectionHeader('ملخص سريع')}
    <div class="card">
      <div class="stat-grid">
        ${statBox(String(sum.open), 'مهام مفتوحة')}
        ${statBox(String(sum.overdue), 'مهام متأخرة')}
        ${statBox(String(sum.doneToday), 'أنجزت اليوم')}
      </div>
    </div>

    <div class="card">
      <div class="card-title-row"><h2>الملف الدراسي</h2><button class="btn btn-sm btn-soft" data-act="edit-profile">تعديل</button></div>
      <div class="list-row"><div class="lr-main"><strong>الصف</strong></div><div class="lr-side">${esc(p.grade || '—')}</div></div>
      <div class="list-row"><div class="lr-main"><strong>نظام التعليم</strong></div><div class="lr-side">${esc(p.system || '—')}</div></div>
      <div class="list-row"><div class="lr-main"><strong>القسم</strong></div><div class="lr-side">${esc(p.section || '—')}</div></div>
      <div class="list-row"><div class="lr-main"><strong>اللغة</strong></div><div class="lr-side">${state.settings.profile.lang === 'en' ? 'English' : 'العربية'}</div></div>
    </div>`;

  return {
    html: profile,
    onMount(root) {
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        if (btn.dataset.act === 'nav') { navigate(btn.dataset.href); return; }
        if (btn.dataset.act === 'edit-profile') openProfileModal();
      });
    },
  };
}

function openProfileModal() {
  const p = state.settings.profile || {};
  openModal({
    title: 'تعديل الملف الدراسي',
    bodyHTML: `
      <form id="profile-form">
        ${field('name', 'الاسم', p.name || '', {})}
        ${field('grade', 'الصف الدراسي', p.grade || 'الصف الثاني الثانوي', {})}
        ${selectField('system', 'نظام التعليم', [
          { value: 'الأزهري', label: 'الأزهري' },
          { value: 'الحكومي', label: 'الحكومي' },
          { value: 'اللغات', label: 'اللغات' },
          { value: 'أخرى', label: 'أخرى' },
        ], p.system || 'الأزهري')}
        ${selectField('section', 'القسم', [
          { value: 'القسم الأدبي', label: 'القسم الأدبي' },
          { value: 'القسم العلمي', label: 'القسم العلمي' },
          { value: 'أخرى', label: 'أخرى' },
        ], p.section || 'القسم الأدبي')}
      </form>`,
    actionsHTML: `<button class="btn btn-primary" data-save-profile>حفظ</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-save-profile]')) return;
        const v = collectForm(mroot.querySelector('#profile-form'));
        const { saveSettings } = await import('../../core/store.js');
        await saveSettings({ profile: { ...p, ...v } });
        close();
        toast('تم الحفظ ✓', 'ok');
      });
    },
  });
}

/* ================= شاشة المهام ================= */

let taskFilter = 'all'; // all | today | week | overdue | done

export function renderTasks() {
  const today = todayISO();
  const all = state.tasks;
  const over = overdueTasks();
  const open = openTasks();
  const dueRev = revisionDueOn(today);
  const missedRev = missedRevisions();

  let list = [];
  if (taskFilter === 'all') list = [...over.filter((t) => t.status === 'open'), ...open.filter((t) => !over.includes(t))];
  else if (taskFilter === 'today') list = all.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === today);
  else if (taskFilter === 'week') {
    const end = addDaysISO(today, 7);
    list = all.filter((t) => t.dueAt && t.dueAt.slice(0, 10) >= today && t.dueAt.slice(0, 10) < end);
  } else if (taskFilter === 'overdue') list = over;
  else if (taskFilter === 'done') list = all.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  return {
    html: `
      <div class="row-between" style="margin-bottom:10px">
        <h1 style="margin:0">المهام والواجبات</h1>
        <button class="btn btn-primary btn-sm" data-act="add-task">+ مهمة</button>
      </div>

      ${over.length ? notice('warn', '<strong>⚠ ' + over.length + ' مهام متأخرة.</strong> ابدأ بالأولوية العالية.') : ''}

      <div class="category-tabs">
        ${[['all', 'الكل'], ['today', 'اليوم'], ['week', 'الأسبوع'], ['overdue', 'المتأخرة'], ['done', 'المنجزة']]
          .map(([k, l]) => `<button class="cat-tab ${taskFilter === k ? 'active' : ''}" data-act="filter" data-filter="${k}">${l}</button>`).join('')}
      </div>

      ${list.length
        ? list.map((t) => taskRow(t, { subjectName: t.subject ? (subjectById(t.subject)?.nameAr || '') : '' })).join('')
        : emptyState('✅', 'لا توجد مهام هنا', 'أضف واجباتك ومهامك لتتبع مواعيدها.', '<button class="btn btn-primary" data-act="add-task">+ إضافة مهمة</button>')}

      ${missedRev.length ? `
        ${sectionHeader('مراجعات متأخرة')}
        ${notice('info', 'لديك ' + missedRev.length + ' مراجعات متباعدة فائت مواعيدها. اقتراحنا: جدولها في أقرب فراغ دون المساس بالدروس المؤكدة.')}
        ${missedRev.map((m) => `
          <div class="card">
            <div class="row-between">
              <div>
                <strong>🔁 ${esc(m.revision.title)}</strong>
                <div class="small muted">فاتت مواعيد: ${m.missedDates.map((d) => fmtDayRel(d)).join('، ')}</div>
              </div>
              <button class="btn btn-sm btn-success" data-act="rev-done" data-id="${esc(m.revision.id)}">راجع الآن</button>
            </div>
          </div>`).join('')}
      ` : ''}

      ${dueRev.length ? `
        ${sectionHeader('مراجعات اليوم')}
        ${dueRev.map((r) => `
          <div class="card">
            <div class="row-between">
              <div><strong>🔁 ${esc(r.title)}</strong><div class="small muted">مستحقة اليوم</div></div>
              <button class="btn btn-sm btn-success" data-act="rev-done" data-id="${esc(r.id)}">تمت</button>
            </div>
          </div>`).join('')}
      ` : ''}
    `,
    onMount(root) {
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'filter') {
          taskFilter = btn.dataset.filter;
          import('../router.js').then((r) => r.requestRender());
        } else if (act === 'add-task') {
          openTaskModal();
        } else if (act === 'toggle-task') {
          const t = state.tasks.find((x) => x.id === btn.dataset.id);
          if (!t) return;
          if (t.status === 'done') await reopenTask(t.id);
          else {
            await completeTask(t.id);
            toast('أحسنت! مهمة منجزة 🎉', 'ok');
          }
        } else if (act === 'edit-task') {
          openTaskModal(btn.dataset.id);
        } else if (act === 'rev-done') {
          await markRevisionDone(btn.dataset.id);
          toast('تمت المراجعة ✓', 'ok');
        }
      });
    },
  };
}

/* ---------- نموذج المهمة الكامل ---------- */

export function openTaskModal(taskId = null) {
  const task = taskId ? state.tasks.find((x) => x.id === taskId) : null;
  const subjects = state.subjects.filter((s) => !s.archived).map((s) => ({ value: s.id, label: s.nameAr }));
  const t = task || {
    title: '', subject: '', dueAt: todayISO() + 'T18:00', estimatedMinutes: 30,
    priority: 'medium', notes: '', steps: [], recurring: 'none',
  };

  openModal({
    title: task ? 'تعديل المهمة' : 'مهمة جديدة',
    bodyHTML: `
      <form id="task-form">
        ${field('title', 'عنوان المهمة', t.title, { required: true })}
        ${selectField('subject', 'المادة', [{ value: '', label: 'بدون مادة' }, ...subjects], t.subject || '')}
        <div class="field-row">
          ${field('dueDate', 'تاريخ الاستحقاق', (t.dueAt || todayISO() + 'T18:00').slice(0, 10), { type: 'date' })}
          ${field('dueTime', 'الوقت', (t.dueAt || todayISO() + 'T18:00').slice(11, 16) || '18:00', { type: 'time' })}
        </div>
        <div class="field-row">
          ${selectField('priority', 'الأولوية', [
            { value: 'high', label: '🔴 عالية' },
            { value: 'medium', label: '🟠 متوسطة' },
            { value: 'low', label: '⚪ منخفضة' },
          ], t.priority)}
          ${field('estimatedMinutes', 'المدة المتوقعة (دقيقة)', String(t.estimatedMinutes || 30), { type: 'number', attrs: 'min="5" step="5"' })}
        </div>
        ${selectField('recurring', 'التكرار', [
          { value: 'none', label: 'بدون تكرار' },
          { value: 'daily', label: 'يوميًا' },
          { value: 'weekly', label: 'أسبوعيًا' },
        ], t.recurring || 'none')}
        ${textareaField('notes', 'ملاحظات', t.notes || '')}

        <div class="field">
          <label>خطوات التنفيذ (اختياري)</label>
          <div id="steps-editor">
            ${(t.steps || []).map((s, i) => `
              <div class="row" style="margin-bottom:6px">
                <input class="input step-input" value="${esc(s.text)}" data-step-id="${esc(s.id)}" placeholder="خطوة ${i + 1}">
                <button type="button" class="btn btn-sm btn-ghost" data-remove-step="${esc(s.id)}">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" class="btn btn-sm btn-soft" data-add-step>+ خطوة</button>
        </div>

        <div class="check-row">
          <input type="checkbox" id="f-makeRevision" name="makeRevision">
          <label for="f-makeRevision">إنشاء خطة مراجعة متباعدة لهذا الموضوع (${(state.settings.revisionIntervals || [0, 1, 3, 7]).join('، ')} أيام)</label>
        </div>
      </form>
      ${task ? `<hr class="divider"><button class="btn btn-danger btn-sm" data-delete-task>حذف المهمة</button>` : ''}
    `,
    actionsHTML: `<button class="btn btn-primary" data-save-task>${task ? 'حفظ' : 'إضافة'}</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        const addStep = e.target.closest('[data-add-step]');
        if (addStep) {
          const editor = mroot.querySelector('#steps-editor');
          const div = document.createElement('div');
          div.className = 'row';
          div.style.marginBottom = '6px';
          div.innerHTML = `<input class="input step-input" placeholder="خطوة جديدة"><button type="button" class="btn btn-sm btn-ghost" data-remove-step="">✕</button>`;
          editor.appendChild(div);
          return;
        }
        const remStep = e.target.closest('[data-remove-step]');
        if (remStep) {
          remStep.closest('.row').remove();
          return;
        }
        const del = e.target.closest('[data-delete-task]');
        if (del) {
          const ok = await confirmDialog({ title: 'حذف المهمة', message: 'سيتم حذف المهمة نهائيًا. متأكد؟', okText: 'حذف', danger: true });
          if (ok) {
            await removeTask(task.id);
            close();
            toast('تم الحذف', 'ok');
          }
          return;
        }
        if (!e.target.closest('[data-save-task]')) return;

        const v = collectForm(mroot.querySelector('#task-form'));
        if (!v.title.trim()) { toast('العنوان مطلوب', 'err'); return; }
        const steps = Array.from(mroot.querySelectorAll('.step-input'))
          .map((inp) => ({ id: inp.dataset.stepId || ('st-' + Math.random().toString(36).slice(2, 8)), text: inp.value.trim(), done: false }))
          .filter((s) => s.text);

        const rec = {
          ...(task || createTask({})),
          title: v.title.trim(),
          subject: v.subject || null,
          dueAt: v.dueDate ? v.dueDate + 'T' + (v.dueTime || '18:00') : null,
          estimatedMinutes: parseInt(v.estimatedMinutes, 10) || 30,
          priority: v.priority,
          recurring: v.recurring || 'none',
          notes: v.notes || '',
          steps,
        };
        await saveTask(rec);

        if (v.makeRevision) {
          const plan = createRevisionPlan({
            title: rec.title,
            subject: rec.subject,
            learnedDate: rec.dueAt ? rec.dueAt.slice(0, 10) : todayISO(),
            intervals: state.settings.revisionIntervals,
          });
          await saveRevision(plan);
        }
        close();
        toast('تم الحفظ ✓', 'ok');
      });
    },
  });
}
