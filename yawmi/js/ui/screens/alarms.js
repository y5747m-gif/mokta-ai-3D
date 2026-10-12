/* ============================================================
 * alarms.js (screen) — إدارة المنبهات والتذكيرات + السجل
 * ============================================================ */

import {
  esc, openModal, confirmDialog, collectForm, toast, field, selectField,
  textareaField, toggleRow, daysPicker,
} from '../dom.js';
import { alarmRow, notice, sectionHeader, emptyState, statBox } from '../components.js';
import { state, putItem } from '../../core/store.js';
import {
  nextAlarm, saveAlarm, removeAlarm, toggleAlarm, testAlarm,
  alarmHistory, categoryLabel,
} from '../../features/alarms.js';
import { permissionState, requestPermission, permissionMessage } from '../../core/notify.js';
import { ALARM_CATEGORIES, ALARM_SOUNDS } from '../../data/defaults.js';
import { fmtTime, fmtRel, fmtDayRel, fmtDate } from '../../core/format.js';
import { uid } from '../../core/ids.js';
import { nextOccurrence } from '../../core/time.js';

let categoryFilter = 'all';

export function renderAlarms() {
  const perm = permissionState();
  const next = nextAlarm(state.alarms);
  const alarms = [...state.alarms].sort((a, b) => (a.time > b.time ? 1 : -1));
  const filtered = categoryFilter === 'all' ? alarms : alarms.filter((a) => a.category === categoryFilter);
  const history = alarmHistory(20);
  const enabledCount = state.alarms.filter((a) => a.enabled).length;

  return {
    html: `
      <div class="row-between" style="margin-bottom:10px">
        <h1 style="margin:0">المنبهات والتذكيرات</h1>
        <button class="btn btn-primary btn-sm" data-act="add-alarm">+ منبه</button>
      </div>

      <!-- حالة الصلاحية بصدق -->
      ${perm === 'granted'
        ? notice('ok', permissionMessage())
        : notice(perm === 'denied' ? 'warn' : 'info', permissionMessage() + (perm !== 'unsupported' ? ' <button class="btn btn-sm btn-soft" data-act="ask-perm" style="margin-inline-start:6px">' + (perm === 'denied' ? 'كيف أفعّلها؟' : 'تفعيل الإشعارات') + '</button>' : ''))}

      <!-- المنبه القادم -->
      <div class="countdown-card" style="border-color:var(--amber)">
        <div class="countdown-main">
          <div class="eyebrow" style="color:var(--amber)">المنبه القادم</div>
          ${next ? `
            <h2>⏰ ${esc(next.alarm.title)}</h2>
            <div class="sub">${fmtDate(next.at.toISOString().slice(0, 10))} — ${fmtTime(next.alarm.time)} • ${fmtRel(Math.round((next.at - new Date()) / 60000))}</div>
          ` : '<h2>لا توجد منبهات مفعّلة</h2><div class="sub">فعّل منبهًا أو أضف واحدًا جديدًا</div>'}
        </div>
        <div class="stat-grid" style="grid-template-columns:1fr">
          ${statBox(enabledCount + '/' + state.alarms.length, 'منبهات مفعّلة')}
        </div>
      </div>

      <!-- فئات -->
      <div class="category-tabs">
        <button class="cat-tab ${categoryFilter === 'all' ? 'active' : ''}" data-act="filter" data-cat="all">الكل</button>
        ${Object.entries(ALARM_CATEGORIES).map(([k, c]) => `
          <button class="cat-tab ${categoryFilter === k ? 'active' : ''}" data-act="filter" data-cat="${k}">${c.icon} ${c.ar}</button>
        `).join('')}
      </div>

      <!-- القائمة -->
      ${filtered.length
        ? filtered.map((a) => {
            const at = nextOccurrence(a);
            return alarmRow(a, at ? fmtDayRel(isoOf(at)) + ' ' + fmtTime(a.time) : null);
          }).join('')
        : emptyState('🔕', 'لا توجد منبهات هنا', 'أضف منبهًا جديدًا أو اختر فئة أخرى.')}

      <button class="btn btn-soft btn-block mt-1" data-act="add-alarm">+ إضافة منبه جديد</button>

      <!-- ملاحظة الأمانة -->
      ${sectionHeader('كيف تعمل المنبهات على هذه المنصة؟')}
      <div class="card">
        <p class="small muted mb-0">
          يعمل تطبيق «يومي» كتطبيق ويب تقدمي (PWA). المنبهات تعمل بشكل موثوق أثناء فتح التطبيق،
          وبشكل أفضل عند تفعيل إذن الإشعارات وتركيب التطبيق على الشاشة الرئيسية.
          قد تتأخر إشعارات الخلفية في بعض المتصفحات والأجهزة (خاصة عند إغلاق المتصفح تمامًا أو وضع توفير الطاقة).
          <strong>المنبه الصباحي المهم:</strong> اترك التطبيق مفتوحًا قبل النوم مع منع إطفاء الشاشة من زر «إبقاء الشاشة» في الإعدادات،
          أو استخدم المنبه الأصلي للجهاز كاحتياط. التفاصيل الكاملة في «الإعدادات ← حول المنصة».
        </p>
      </div>

      <!-- السجل -->
      ${sectionHeader('سجل المنبهات')}
      <div class="card">
        ${history.length ? history.map((h) => `
          <div class="history-item">
            <span class="h-status chip ${h.status === 'fired' ? 'chip-blue' : h.status === 'missed' ? 'chip-red' : h.status === 'completed' ? 'chip-green' : 'chip-neutral'}">
              ${h.status === 'fired' ? 'انطلق' : h.status === 'missed' ? 'فات' : h.status === 'completed' ? 'تم ✓' : h.status === 'dismissed' ? 'أُوقف' : 'مؤجّل'}
            </span>
            <div style="flex:1;min-width:0">
              <div class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.title)}</div>
              <div class="xsmall muted ltr">${(h.at || '').replace('T', ' ')}</div>
            </div>
          </div>`).join('')
        : '<p class="muted small mb-0">لا يوجد سجل بعد.</p>'}
      </div>
    `,
    onMount(root) {
      wireAlarms(root);
    },
  };
}

function isoOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function wireAlarms(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'filter') {
      categoryFilter = btn.dataset.cat;
      import('../router.js').then((r) => r.requestRender());
      return;
    }
    if (act === 'add-alarm') {
      openAlarmModal(null);
      return;
    }
    if (act === 'edit-alarm') {
      const a = state.alarms.find((x) => x.id === btn.dataset.id);
      if (a) openAlarmModal(a);
      return;
    }
    if (act === 'ask-perm') {
      if (permissionState() === 'denied') {
        openModal({
          title: 'تفعيل الإشعارات يدويًا',
          bodyHTML: `
            <p class="muted small">لأنك رفضت الإذن سابقًا، لا يمكن للتطبيق طلبه مرة أخرى تلقائيًا. يمكنك تفعيله من إعدادات المتصفح:</p>
            <ol class="small muted" style="padding-inline-start:20px;line-height:2">
              <li>اضغط على أيقونة القفل 🔒 بجانب عنوان الموقع.</li>
              <li>اختر «الإعدادات» أو «الأذونات».</li>
              <li>فعّل «الإشعارات» (Notifications).</li>
              <li>أعد تحميل التطبيق.</li>
            </ol>
            <p class="small muted">على أندرويد عبر Chrome: اضغط مطوّلًا على أيقونة التطبيق ← معلومات التطبيق ← الإشعارات.</p>`,
        });
      } else {
        const res = await requestPermission();
        toast(res === 'granted' ? 'تم تفعيل الإشعارات ✓' : 'لم يتم التفعيل', res === 'granted' ? 'ok' : 'err');
      }
      return;
    }
    if (act === 'delete-alarm') {
      const ok = await confirmDialog({
        title: 'حذف المنبه',
        message: 'هل أنت متأكد من حذف هذا المنبه نهائيًا؟',
        okText: 'حذف', danger: true,
      });
      if (ok) {
        await removeAlarm(btn.dataset.id);
        toast('تم الحذف', 'ok');
      }
      return;
    }
    if (act === 'test-alarm') {
      const a = state.alarms.find((x) => x.id === btn.dataset.id);
      if (a) {
        toast('تجربة المنبه الآن…', '');
        await testAlarm(a);
      }
      return;
    }
  });

  root.addEventListener('change', async (e) => {
    const t = e.target.closest('[data-act="toggle-alarm"]');
    if (!t) return;
    const a = state.alarms.find((x) => x.id === t.dataset.id);
    if (!a) return;
    if (t.checked && permissionState() === 'default') {
      // طلب الصلاحية في وقت مناسب: عند تفعيل أول منبه
      const res = await requestPermission();
      if (res !== 'granted') {
        toast('تنبيه: بدون إذن الإشعارات تعمل المنبهات داخل التطبيق فقط', '');
      }
    }
    await toggleAlarm(t.dataset.id, t.checked);
    import('../router.js').then((r) => r.requestRender());
  });
}

/* ---------- نموذج المنبه ---------- */

export function openAlarmModal(alarm = null) {
  const isEdit = !!alarm;
  const a = alarm || {
    category: 'custom', title: '', message: '', time: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily', enabled: true,
    sound: 'gentle', vibrate: true, snoozeEnabled: true, snoozeMinutes: 10,
    date: null,
  };

  openModal({
    title: isEdit ? 'تعديل المنبه' : 'منبه جديد',
    bodyHTML: `
      <form id="alarm-form">
        ${selectField('category', 'الفئة', Object.entries(ALARM_CATEGORIES).map(([k, c]) => ({ value: k, label: c.icon + ' ' + c.ar })), a.category)}
        ${field('title', 'العنوان', a.title, { required: true, attrs: 'placeholder="مثال: الاستيقاظ للامتحان"' })}
        ${textareaField('message', 'الرسالة (تظهر في الإشعار)', a.message || '')}
        ${field('time', 'الوقت', a.time, { type: 'time', required: true })}
        ${selectField('repeat', 'التكرار', [
          { value: 'daily', label: 'يوميًا' },
          { value: 'weekly', label: 'أيام محددة' },
          { value: 'once', label: 'مرة واحدة' },
        ], a.repeat)}
        ${field('date', 'التاريخ (لمنبه مرة واحدة)', a.date || '', { type: 'date' })}
        ${daysPicker('days', a.days || [])}
        <hr class="divider">
        ${selectField('sound', 'الصوت', Object.entries(ALARM_SOUNDS).map(([k, s]) => ({ value: k, label: s.ar })), a.sound)}
        ${toggleRow('vibrate', 'الاهتزاز', a.vibrate !== false)}
        ${toggleRow('snoozeEnabled', 'السماح بالتأجيل', a.snoozeEnabled !== false)}
        ${selectField('snoozeMinutes', 'مدة التأجيل', [
          { value: '5', label: '5 دقائق' },
          { value: '10', label: '10 دقائق' },
          { value: '15', label: '15 دقيقة' },
        ], String(a.snoozeMinutes || 10))}
        ${toggleRow('enabled', 'مفعّل', a.enabled !== false)}
      </form>
      ${isEdit ? `
        <hr class="divider">
        <div class="btn-row">
          <button class="btn btn-soft btn-sm" data-act="test-alarm" data-id="${esc(a.id)}">🔔 تجربة المنبه</button>
          <button class="btn btn-danger btn-sm" data-act="delete-alarm" data-id="${esc(a.id)}">حذف</button>
        </div>` : ''}
    `,
    actionsHTML: `<button class="btn btn-primary" data-save-alarm>${isEdit ? 'حفظ' : 'إضافة المنبه'}</button>`,
    onMount(mroot, close) {
      // أزرار الحذف/التجربة داخل النموذج
      mroot.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-act="delete-alarm"]');
        if (del) {
          const ok = await confirmDialog({
            title: 'حذف المنبه', message: 'هل أنت متأكد؟', okText: 'حذف', danger: true,
          });
          if (ok) {
            await removeAlarm(del.dataset.id);
            close();
            toast('تم الحذف', 'ok');
          }
          return;
        }
        const test = e.target.closest('[data-act="test-alarm"]');
        if (test) {
          const t = state.alarms.find((x) => x.id === test.dataset.id);
          if (t) { toast('تجربة…', ''); await testAlarm(t); }
          return;
        }
        if (!e.target.closest('[data-save-alarm]')) return;

        const form = mroot.querySelector('#alarm-form');
        const v = collectForm(form);
        if (!v.title.trim()) { toast('العنوان مطلوب', 'err'); return; }
        const repeat = v.repeat || 'daily';
        const days = v.days && v.days.length ? v.days : [0, 1, 2, 3, 4, 5, 6];

        if (permissionState() === 'default') {
          const res = await requestPermission();
          if (res !== 'granted') {
            toast('بدون إذن الإشعارات ستعمل المنبهات داخل التطبيق فقط', '');
          }
        }

        const rec = {
          id: a.id || 'al-' + uid(),
          category: v.category,
          title: v.title.trim(),
          message: (v.message || '').trim(),
          time: v.time,
          repeat,
          date: repeat === 'once' ? v.date : null,
          days: repeat === 'once' ? [] : days,
          enabled: !!v.enabled,
          sound: v.sound,
          vibrate: !!v.vibrate,
          snoozeEnabled: !!v.snoozeEnabled,
          snoozeMinutes: parseInt(v.snoozeMinutes, 10) || 10,
          linkedEventId: a.linkedEventId || null,
          createdAt: a.createdAt || Date.now(),
          updatedAt: Date.now(),
          source: a.source || 'user',
        };
        await saveAlarm(rec);
        close();
        toast('تم الحفظ ✓ — المنبه القادم: ' + fmtTime(rec.time), 'ok');
      });
    },
  });
}
