/* ============================================================
 * settings.js — الإعدادات الكاملة + النسخ الاحتياطي + حول المنصة
 * ============================================================ */

import {
  esc, openModal, confirmDialog, collectForm, toast, field, selectField,
  toggleRow,
} from '../dom.js';
import { notice, sectionHeader } from '../components.js';
import { state, saveSettings, replaceCollection } from '../../core/store.js';
import { downloadBackup, restoreBackup, readFileAsJSON, buildBackup } from '../../core/backup.js';
import { permissionState, requestPermission, permissionMessage } from '../../core/notify.js';
import { DEFAULT_WEEK, DEFAULT_ALARMS, ALARM_SOUNDS } from '../../data/defaults.js';
import { setLang, getLang, t } from '../../core/i18n.js';
import { fmtTime } from '../../core/format.js';
import { playSound, vibrate } from '../../audio/tone.js';

function seededEvents() {
  const out = [];
  for (const dayKey of Object.keys(DEFAULT_WEEK)) {
    const day = parseInt(dayKey, 10);
    DEFAULT_WEEK[day].forEach((e, i) => {
      out.push({
        id: 'we-' + day + '-' + i,
        kind: 'weekly', day, date: null,
        title: e.title, titleEn: e.titleEn || null, type: e.type,
        start: e.start, end: e.end, subject: e.subject || null,
        notes: e.notes || '', confirmed: e.confirmed !== false, optional: !!e.optional,
        adjustable: !!e.adjustable, enabled: e.enabled !== false,
        travelMinutes: e.travelMinutes ?? null,
        altTitle: e.altTitle || null, altType: e.altType || null,
        reminderOffsets: e.type === 'lesson' ? [...state.settings.reminderOffsets] : [],
      });
    });
  }
  return out;
}

export function renderSettings() {
  const s = state.settings;
  const perm = permissionState();

  return {
    html: `
      <h1>الإعدادات</h1>

      <!-- المظهر واللغة -->
      <div class="settings-section">
        <h3>المظهر واللغة</h3>
        <div class="list-card">
          <div class="list-row">
            <div class="lr-main"><strong>الوضع</strong><small>فاتح أو داكن</small></div>
            <div class="segmented" style="width:170px">
              <button class="${s.theme !== 'dark' ? 'active' : ''}" data-act="theme" data-theme="light">☀️ فاتح</button>
              <button class="${s.theme === 'dark' ? 'active' : ''}" data-act="theme" data-theme="dark">🌙 داكن</button>
            </div>
          </div>
          <div class="list-row">
            <div class="lr-main"><strong>اللغة</strong><small>لغة الواجهة</small></div>
            <div class="segmented" style="width:170px">
              <button class="${getLang() !== 'en' ? 'active' : ''}" data-act="lang" data-lang="ar">العربية</button>
              <button class="${getLang() === 'en' ? 'active' : ''}" data-act="lang" data-lang="en">English</button>
            </div>
          </div>
        </div>
      </div>

      <!-- الروتين اليومي -->
      <div class="settings-section">
        <h3>الروتين اليومي</h3>
        <div class="list-card">
          <button class="list-row clickable" data-act="edit-routine">
            <div class="lr-main"><strong>أوقات اليوم</strong><small>الاستيقاظ ${fmtTime(s.wakeTime)} • النوم ${fmtTime(s.bedTime)} • الرياضة ${s.exerciseMinutes} دقيقة</small></div>
            <div class="lr-side">›</div>
          </button>
          <button class="list-row clickable" data-act="edit-travel">
            <div class="lr-main"><strong>التنقل والسفر</strong><small>السفر الافتراضي ${s.lessonTravelMinutes} دقيقة • وقت التنقل بين الدروس ${s.transitionMinutes} دقيقة</small></div>
            <div class="lr-side">›</div>
          </button>
          <button class="list-row clickable" data-act="edit-study-cfg">
            <div class="lr-main"><strong>جلسات المذاكرة</strong><small>${s.studyMinutes} دقيقة مذاكرة • ${s.breakMinutes} استراحة • ${s.longBreakMinutes} استراحة طويلة بعد ${s.sessionsUntilLongBreak}</small></div>
            <div class="lr-side">›</div>
          </button>
          <button class="list-row clickable" data-act="edit-revision">
            <div class="lr-main"><strong>فترات المراجعة المتباعدة</strong><small>${(s.revisionIntervals || [0, 1, 3, 7]).map((n) => n === 0 ? 'يوم التعلم' : n + ' يوم').join(' • ')}</small></div>
            <div class="lr-side">›</div>
          </button>
        </div>
      </div>

      <!-- التنبيهات -->
      <div class="settings-section">
        <h3>التنبيهات والإشعارات</h3>
        <div class="list-card">
          <div class="list-row">
            <div class="lr-main"><strong>حالة صلاحية الإشعارات</strong><small>${esc(permissionMessage())}</small></div>
            <button class="btn btn-sm ${perm === 'granted' ? 'btn-success' : 'btn-soft'}" data-act="ask-perm" ${perm === 'granted' || perm === 'unsupported' ? 'disabled' : ''}>
              ${perm === 'granted' ? '✓ مفعّلة' : 'تفعيل'}
            </button>
          </div>
          <button class="list-row clickable" data-act="edit-reminders">
            <div class="lr-main"><strong>مواعيد التذكير قبل الدروس</strong><small>${(s.reminderOffsets || []).map((o) => o === 0 ? 'عند البدء' : 'قبل ' + o + ' دقيقة').join(' • ')}${s.travelReminder ? ' • + تذكير السفر' : ''}</small></div>
            <div class="lr-side">›</div>
          </button>
          <div class="list-row">
            <div class="lr-main"><strong>الصوت</strong><small>نغمات المنبه والتغذية الراجعة</small></div>
            <select class="select" id="sound-select" style="width:150px">
              ${Object.entries(ALARM_SOUNDS).map(([k, v]) => `<option value="${k}" ${s.soundName === k ? 'selected' : ''}>${v.ar}</option>`).join('')}
            </select>
          </div>
          <div class="list-row">
            <div class="lr-main"><strong>الاهتزاز</strong><small>عند المنبهات والتذكيرات</small></div>
            <input type="checkbox" class="toggle" id="vibrate-toggle" ${s.vibrate ? 'checked' : ''}>
          </div>
          <button class="list-row clickable" data-act="edit-quiet">
            <div class="lr-main"><strong>ساعات الهدوء</strong><small>${s.quietHoursEnabled ? fmtTime(s.quietHoursStart) + ' — ' + fmtTime(s.quietHoursEnd) + ' (تُكتم التنبيهات غير المهمة)' : 'معطّلة'}</small></div>
            <div class="lr-side">›</div>
          </button>
          <div class="list-row">
            <div class="lr-main"><strong>السماح بالتأجيل</strong><small>مدة التأجيل الافتراضية ${s.snoozeMinutes} دقيقة</small></div>
            <input type="checkbox" class="toggle" id="snooze-toggle" ${s.snoozeEnabled ? 'checked' : ''}>
          </div>
        </div>
      </div>

      <!-- الموثوقية -->
      <div class="settings-section">
        <h3>موثوقية المنبهات</h3>
        <div class="list-card">
          <div class="list-row">
            <div class="lr-main"><strong>إبقاء الشاشة مضاءة عند المنبه</strong><small>مفيد للمنبه الصباحي أثناء شحن الهاتف</small></div>
            <input type="checkbox" class="toggle" id="wakelock-toggle" ${s.wakeLockOnAlarm ? 'checked' : ''}>
          </div>
          <div class="list-row">
            <div class="lr-main"><strong>منع إغلاق الشاشة قبل منبه الاستيقاظ</strong><small>يزيد الموثوقية لكن يستهلك بطارية أكثر</small></div>
            <input type="checkbox" class="toggle" id="keepawake-toggle" ${s.keepAwakeBeforeWakeAlarm ? 'checked' : ''}>
          </div>
        </div>
      </div>

      <!-- البيانات -->
      <div class="settings-section">
        <h3>البيانات والخصوصية</h3>
        <div class="list-card">
          <button class="list-row clickable" data-act="export">
            <div class="lr-main"><strong>تصدير البيانات</strong><small>تنزيل نسخة احتياطية كاملة (JSON)</small></div>
            <div class="lr-side">↓</div>
          </button>
          <button class="list-row clickable" data-act="import">
            <div class="lr-main"><strong>استيراد نسخة احتياطية</strong><small>استعادة بياناتك من ملف محفوظ</small></div>
            <div class="lr-side">↑</div>
          </button>
          <button class="list-row clickable" data-act="restore-schedule">
            <div class="lr-main"><strong>استعادة الجدول الافتراضي</strong><small>إعادة جدول الأسبوع الأصلي (بتأكيد)</small></div>
            <div class="lr-side">↺</div>
          </button>
        </div>
        ${notice('info', 'كل بياناتك محفوظة محليًا على جهازك (IndexedDB). لا حسابات، ولا اشتراكات، ولا إرسال لأي خادم. يمكنك تصدير نسخة احتياطية في أي وقت.')}
      </div>

      <!-- حول المنصة -->
      <div class="settings-section">
        <h3>حول المنصة والحدود</h3>
        <div class="card">
          <p class="small muted">
            <strong>يومي | YAWMI</strong> تطبيق ويب تقدمي (PWA) يعمل دون إنترنت بعد أول فتح، ويمكن تثبيته على شاشة الهاتف الرئيسية.
          </p>
          <p class="small muted">
            <strong>حدود صادقة يجب أن تعرفها:</strong>
          </p>
          <ul class="small muted" style="padding-inline-start:20px;line-height:2">
            <li>المنبهات تعمل بشكل موثوق <em>داخل التطبيق</em> وبشكل جيد عند تفعيل الإشعارات.</li>
            <li>إذا أغلقت المتصفح تمامًا أو عمل نظام توفير الطاقة، قد تتأخر إشعارات الخلفية أو لا تصل — هذا قيد في المتصفحات وليس في التطبيق.</li>
            <li>للاستيقاظ في ميعاد مضمون 100%: اترك التطبيق مفتوحًا (مع منع إطفاء الشاشة) أو استخدم منبه الجهاز الأصلي كاحتياط.</li>
            <li>منصات أندرويد عبر Chrome تدعم إشعارات أفضل عند تثبيت التطبيق من القائمة «إضافة إلى الشاشة الرئيسية».</li>
          </ul>
          <p class="small muted mb-0">الإصدار 1.0 • يعمل محليًا بالكامل • لا يجمع أي بيانات.</p>
        </div>
      </div>
    `,
    onMount(root) {
      wireSettings(root);
    },
  };
}

function wireSettings(root) {
  const s = state.settings;

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'theme') {
      const theme = btn.dataset.theme;
      await saveSettings({ theme });
      document.documentElement.setAttribute('data-theme', theme);
      import('../router.js').then((r) => r.requestRender());
      return;
    }
    if (act === 'lang') {
      const lang = btn.dataset.lang;
      setLang(lang);
      await saveSettings({ profile: { ...s.profile, lang } });
      document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'ar');
      document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
      import('../router.js').then((r) => r.requestRender());
      toast(lang === 'en' ? 'Language changed' : 'تم تغيير اللغة', 'ok');
      return;
    }
    if (act === 'ask-perm') {
      const res = await requestPermission();
      toast(res === 'granted' ? 'تم ✓' : 'لم يتم التفعيل', res === 'granted' ? 'ok' : 'err');
      import('../router.js').then((r) => r.requestRender());
      return;
    }
    if (act === 'edit-routine') {
      openModal({
        title: 'أوقات اليوم',
        bodyHTML: `
          <form id="routine-form">
            ${field('wakeTime', 'وقت الاستيقاظ', s.wakeTime, { type: 'time' })}
            ${field('windDownTime', 'بدء الاستعداد للنوم', s.windDownTime, { type: 'time' })}
            ${field('bedTime', 'ميعاد النوم', s.bedTime, { type: 'time' })}
            ${field('latestBedTime', 'آخر موعد مسموح', s.latestBedTime, { type: 'time' })}
            ${field('exerciseMinutes', 'مدة الرياضة الصباحية (دقيقة)', String(s.exerciseMinutes), { type: 'number', attrs: 'min="5" step="5"' })}
          </form>`,
        actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-save]')) return;
            const v = collectForm(mroot.querySelector('#routine-form'));
            await saveSettings({
              wakeTime: v.wakeTime, windDownTime: v.windDownTime, bedTime: v.bedTime,
              latestBedTime: v.latestBedTime, exerciseMinutes: parseInt(v.exerciseMinutes, 10) || 30,
            });
            close(); toast('تم الحفظ ✓', 'ok');
          });
        },
      });
      return;
    }
    if (act === 'edit-travel') {
      openModal({
        title: 'التنقل والسفر',
        bodyHTML: `
          <form id="travel-form">
            ${field('lessonTravelMinutes', 'مدة السفر الافتراضية قبل الدرس (دقيقة)', String(s.lessonTravelMinutes), { type: 'number', attrs: 'min="0" step="5"', hint: 'تُستخدم لتذكير «وقت التوجّه للدرس»' })}
            ${field('transitionMinutes', 'وقت التنقل بين درسين متتاليين (دقيقة)', String(s.transitionMinutes), { type: 'number', attrs: 'min="0" step="5"', hint: 'للدروس المتصلة — يُستخدم في اكتشاف التعارضات وتجنّب التذكيرات المتناقضة' })}
          </form>`,
        actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-save]')) return;
            const v = collectForm(mroot.querySelector('#travel-form'));
            await saveSettings({
              lessonTravelMinutes: parseInt(v.lessonTravelMinutes, 10) || 0,
              transitionMinutes: parseInt(v.transitionMinutes, 10) || 0,
            });
            close(); toast('تم الحفظ ✓', 'ok');
          });
        },
      });
      return;
    }
    if (act === 'edit-study-cfg') {
      openModal({
        title: 'إعدادات جلسات المذاكرة',
        bodyHTML: `
          <form id="studycfg-form">
            ${field('studyMinutes', 'مدة الجلسة (دقيقة)', String(s.studyMinutes), { type: 'number', attrs: 'min="10" max="120"' })}
            ${field('breakMinutes', 'مدة الاستراحة القصيرة', String(s.breakMinutes), { type: 'number', attrs: 'min="3" max="30"' })}
            ${field('longBreakMinutes', 'الاستراحة الطويلة', String(s.longBreakMinutes), { type: 'number', attrs: 'min="10" max="60"' })}
            ${field('sessionsUntilLongBreak', 'استراحة طويلة بعد (جلسات)', String(s.sessionsUntilLongBreak), { type: 'number', attrs: 'min="2" max="8"' })}
            ${field('shortSessionMinutes', 'الجلسة القصيرة للوقت المحدود', String(s.shortSessionMinutes), { type: 'number', attrs: 'min="10" max="40"' })}
          </form>`,
        actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-save]')) return;
            const v = collectForm(mroot.querySelector('#studycfg-form'));
            await saveSettings({
              studyMinutes: parseInt(v.studyMinutes, 10) || 50,
              breakMinutes: parseInt(v.breakMinutes, 10) || 10,
              longBreakMinutes: parseInt(v.longBreakMinutes, 10) || 25,
              sessionsUntilLongBreak: parseInt(v.sessionsUntilLongBreak, 10) || 4,
              shortSessionMinutes: parseInt(v.shortSessionMinutes, 10) || 25,
            });
            close(); toast('تم الحفظ ✓', 'ok');
          });
        },
      });
      return;
    }
    if (act === 'edit-revision') {
      openModal({
        title: 'فترات المراجعة المتباعدة',
        bodyHTML: `
          <form id="revcfg-form">
            ${field('intervals', 'أيام المراجعة (افصل بفاصلة)', (s.revisionIntervals || [0, 1, 3, 7]).join(', '), { hint: '0 = يوم التعلم نفسه. هذه اقتراحات قابلة للتغيير وليست مواعيد مفروضة.' })}
          </form>`,
        actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-save]')) return;
            const v = collectForm(mroot.querySelector('#revcfg-form'));
            const intervals = String(v.intervals).split(/[،,]/).map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
            if (!intervals.length) { toast('أدخل فترة واحدة على الأقل', 'err'); return; }
            await saveSettings({ revisionIntervals: intervals });
            close(); toast('تم الحفظ ✓', 'ok');
          });
        },
      });
      return;
    }
    if (act === 'edit-reminders') {
      openModal({
        title: 'تذكيرات الدروس',
        bodyHTML: `
          <form id="remcfg-form">
            ${field('offsets', 'التوقيتات (بالدقائق قبل الدرس)', (s.reminderOffsets || []).join(', '), { hint: 'مثال: 60, 30, 15, 0 (0 = عند بداية الدرس)' })}
            ${toggleRow('travelReminder', 'تذكير وقت السفر', s.travelReminder !== false, 'قبل الدرس بمدة السفر المحددة')}
          </form>`,
        actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-save]')) return;
            const v = collectForm(mroot.querySelector('#remcfg-form'));
            const offsets = String(v.offsets).split(/[،,]/).map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 720);
            if (!offsets.length) { toast('أدخل توقيتًا واحدًا على الأقل', 'err'); return; }
            await saveSettings({ reminderOffsets: offsets, travelReminder: !!v.travelReminder });
            close(); toast('تم الحفظ ✓', 'ok');
          });
        },
      });
      return;
    }
    if (act === 'edit-quiet') {
      openModal({
        title: 'ساعات الهدوء',
        bodyHTML: `
          <form id="quiet-form">
            ${toggleRow('quietHoursEnabled', 'تفعيل ساعات الهدوء', s.quietHoursEnabled, 'تُكتم التنبيهات غير المهمة خلال هذه الفترة')}
            ${field('quietHoursStart', 'من', s.quietHoursStart, { type: 'time' })}
            ${field('quietHoursEnd', 'إلى', s.quietHoursEnd, { type: 'time' })}
          </form>`,
        actionsHTML: `<button class="btn btn-primary" data-save>حفظ</button>`,
        onMount(mroot, close) {
          mroot.addEventListener('click', async (ev) => {
            if (!ev.target.closest('[data-save]')) return;
            const v = collectForm(mroot.querySelector('#quiet-form'));
            await saveSettings({
              quietHoursEnabled: !!v.quietHoursEnabled,
              quietHoursStart: v.quietHoursStart,
              quietHoursEnd: v.quietHoursEnd,
            });
            close(); toast('تم الحفظ ✓', 'ok');
          });
        },
      });
      return;
    }
    if (act === 'export') {
      downloadBackup();
      toast('تم تنزيل النسخة الاحتياطية ✓', 'ok');
      return;
    }
    if (act === 'import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const obj = await readFileAsJSON(file);
          const ok = await confirmDialog({
            title: 'استيراد نسخة احتياطية',
            message: 'سيتم استبدال البيانات الحالية بمحتوى الملف "' + file.name + '". لا يمكن التراجع. هل تريد المتابعة؟',
            okText: 'استيراد', danger: true,
          });
          if (!ok) return;
          const res = await restoreBackup(obj);
          if (res.ok) {
            toast('تم الاستيراد بنجاح ✓ — أعد تحميل التطبيق', 'ok');
            setTimeout(() => location.reload(), 1200);
          } else {
            toast('فشل الاستيراد: ' + res.errors.join('، '), 'err');
          }
        } catch (err) {
          toast(String(err.message || err), 'err');
        }
      };
      input.click();
      return;
    }
    if (act === 'restore-schedule') {
      const ok = await confirmDialog({
        title: 'استعادة الجدول الافتراضي',
        message: t('confirmRestore'),
        okText: 'استعادة',
      });
      if (ok) {
        await replaceCollection('events', seededEvents());
        toast('تمت استعادة الجدول الافتراضي ✓', 'ok');
      }
      return;
    }
  });

  // مفاتيح التبديل
  root.addEventListener('change', async (e) => {
    const id = e.target.id;
    if (id === 'sound-select') {
      await saveSettings({ soundName: e.target.value });
      playSound(e.target.value);
    } else if (id === 'vibrate-toggle') {
      await saveSettings({ vibrate: e.target.checked });
      if (e.target.checked) vibrate([80]);
    } else if (id === 'snooze-toggle') {
      await saveSettings({ snoozeEnabled: e.target.checked });
    } else if (id === 'wakelock-toggle') {
      await saveSettings({ wakeLockOnAlarm: e.target.checked });
    } else if (id === 'keepawake-toggle') {
      await saveSettings({ keepAwakeBeforeWakeAlarm: e.target.checked });
    }
  });
}
