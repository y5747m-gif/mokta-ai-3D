/* ============================================================
 * subjects.js — إدارة المواد الدراسية (أدهري أدبي)
 * لا نفترض تفاصيل مناهج رسمية — كل شيء قابل للتعديل.
 * ============================================================ */

import {
  esc, openModal, confirmDialog, collectForm, toast, field, selectField,
  textareaField,
} from '../dom.js';
import { sectionHeader, notice, progressRing, emptyState } from '../components.js';
import { state, putItem, deleteItem, newId } from '../../core/store.js';
import { fmtDur } from '../../core/format.js';
import { uid } from '../../core/ids.js';

export function renderSubjects() {
  const subjects = state.subjects.filter((s) => !s.archived);
  const archived = state.subjects.filter((s) => s.archived);
  const totalStudy = new Map();
  for (const s of state.sessions) {
    if (!s.subject) continue;
    totalStudy.set(s.subject, (totalStudy.get(s.subject) || 0) + (s.durationMin || 0));
  }

  return {
    html: `
      <div class="row-between" style="margin-bottom:10px">
        <h1 style="margin:0">المواد الدراسية</h1>
        <button class="btn btn-primary btn-sm" data-act="add-subject">+ مادة</button>
      </div>

      ${notice('info', 'هذه قائمة المواد المذكورة منك: شرعي، عربية، إنجليزية، فرنسية، فلسفة، جغرافيا، تاريخ. يمكنك إضافة أو تعديل أي مادة حسب منهجك الفعلي للعام الدراسي.')}

      ${subjects.map((s) => `
        <div class="card" data-subject="${esc(s.id)}">
          <div class="row-between">
            <div class="row" style="flex:1;min-width:0">
              <div class="habit-ic" style="width:42px;height:42px;font-size:21px">${s.icon || '📘'}</div>
              <div style="flex:1;min-width:0">
                <h3 style="margin:0">${esc(s.nameAr)}</h3>
                <div class="small muted">
                  ${s.teacher ? '👨‍🏫 ' + esc(s.teacher) + ' • ' : ''}
                  ${totalStudy.get(s.id) ? '⏱ ' + fmtDur(totalStudy.get(s.id)) + ' مذاكرة • ' : ''}
                  أولوية: ${s.priority === 'high' ? 'عالية' : s.priority === 'low' ? 'منخفضة' : 'متوسطة'}
                </div>
              </div>
            </div>
            <div style="width:70px">${progressRing(s.progress || 0, { label: 'تقدم', size: 64 })}</div>
          </div>
          ${s.weakTopics && s.weakTopics.length ? `
            <div class="row wrap mt-1">
              <span class="xsmall muted">مواضيع ضعيفة:</span>
              ${s.weakTopics.map((w) => `<span class="chip chip-amber">${esc(w)}</span>`).join('')}
            </div>` : ''}
          <div class="btn-row mt-1">
            <button class="btn btn-sm btn-soft" data-act="edit-subject" data-id="${esc(s.id)}">تعديل</button>
            <button class="btn btn-sm btn-ghost" data-act="archive-subject" data-id="${esc(s.id)}">أرشفة</button>
          </div>
        </div>`).join('')}

      ${archived.length ? `
        ${sectionHeader('مواد مؤرشفة')}
        ${archived.map((s) => `
          <div class="card" style="opacity:.6">
            <div class="row-between">
              <span>${s.icon || '📘'} ${esc(s.nameAr)}</span>
              <button class="btn btn-sm btn-soft" data-act="unarchive-subject" data-id="${esc(s.id)}">استعادة</button>
            </div>
          </div>`).join('')}
      ` : ''}
    `,
    onMount(root) {
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        const id = btn.dataset.id;

        if (act === 'add-subject') openSubjectModal(null);
        else if (act === 'edit-subject') openSubjectModal(state.subjects.find((s) => s.id === id));
        else if (act === 'archive-subject') {
          const s = state.subjects.find((x) => x.id === id);
          if (s) {
            await putItem('subjects', { ...s, archived: true });
            toast('تمت الأرشفة — يمكنك استعادتها لاحقًا', 'ok');
          }
        } else if (act === 'unarchive-subject') {
          const s = state.subjects.find((x) => x.id === id);
          if (s) await putItem('subjects', { ...s, archived: false });
        }
      });
    },
  };
}

function openSubjectModal(subject = null) {
  const s = subject || {
    nameAr: '', nameEn: '', icon: '📘', color: 'var(--c-lesson)',
    priority: 'medium', teacher: '', notes: '', weakTopics: [],
    progress: 0, completedLessons: 0, archived: false,
  };

  openModal({
    title: subject ? 'تعديل المادة' : 'مادة جديدة',
    bodyHTML: `
      <form id="subject-form">
        ${field('nameAr', 'اسم المادة (عربي)', s.nameAr, { required: true })}
        ${field('nameEn', 'اسم المادة (إنجليزي)', s.nameEn || '', {})}
        ${field('icon', 'الرمز (إيموجي)', s.icon || '📘', {})}
        ${selectField('priority', 'الأولوية الشخصية', [
          { value: 'high', label: 'عالية' },
          { value: 'medium', label: 'متوسطة' },
          { value: 'low', label: 'منخفضة' },
        ], s.priority)}
        ${field('teacher', 'المعلم / تفاصيل الدرس', s.teacher || '', {})}
        ${field('progress', 'نسبة التقدم (%)', String(s.progress || 0), { type: 'number', attrs: 'min="0" max="100"' })}
        ${field('completedLessons', 'الدروس المكتملة', String(s.completedLessons || 0), { type: 'number', attrs: 'min="0"' })}
        ${field('weakTopics', 'المواضيع الضعيفة (افصل بفاصلة)', (s.weakTopics || []).join('، '), {})}
        ${textareaField('notes', 'ملاحظات', s.notes || '')}
      </form>
      ${subject ? `<hr class="divider"><button class="btn btn-danger btn-sm" data-delete-subject>حذف المادة نهائيًا</button>` : ''}
    `,
    actionsHTML: `<button class="btn btn-primary" data-save-subject>حفظ</button>`,
    onMount(mroot, close) {
      mroot.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-delete-subject]');
        if (del) {
          const ok = await confirmDialog({
            title: 'حذف المادة',
            message: 'سيتم حذف المادة. لن تُحذف مهامك أو جلساتك المسجلة، لكنها ستظهر بدون مادة. متأكد؟',
            okText: 'حذف', danger: true,
          });
          if (ok) {
            await deleteItem('subjects', subject.id);
            close();
            toast('تم الحذف', 'ok');
          }
          return;
        }
        if (!e.target.closest('[data-save-subject]')) return;

        const v = collectForm(mroot.querySelector('#subject-form'));
        if (!v.nameAr.trim()) { toast('اسم المادة مطلوب', 'err'); return; }
        const rec = {
          id: subject ? subject.id : 'sub-' + uid(),
          nameAr: v.nameAr.trim(),
          nameEn: v.nameEn || '',
          icon: v.icon || '📘',
          color: s.color || 'var(--c-lesson)',
          priority: v.priority,
          teacher: v.teacher || '',
          notes: v.notes || '',
          weakTopics: (v.weakTopics || '').split(/[،,]/).map((x) => x.trim()).filter(Boolean),
          progress: Math.max(0, Math.min(100, parseInt(v.progress, 10) || 0)),
          completedLessons: parseInt(v.completedLessons, 10) || 0,
          archived: !!s.archived,
        };
        await putItem('subjects', rec);
        close();
        toast('تم الحفظ ✓', 'ok');
      });
    },
  });
}
