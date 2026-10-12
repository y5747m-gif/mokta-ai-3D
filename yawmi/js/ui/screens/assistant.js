/* ============================================================
 * assistant.js (screen) — واجهة المساعد الذكي
 * ============================================================ */

import { esc, toast, confirmDialog } from '../dom.js';
import { notice } from '../components.js';
import { respond, applySuggestions } from '../../features/assistant.js';
import { state, putItem, newId } from '../../core/store.js';
import { saveTask, createTask, createRevisionPlan, saveRevision } from '../../features/tasks.js';
import { saveAlarm } from '../../features/alarms.js';
import { fmtTime, fmtDayRel } from '../../core/format.js';
import { uid } from '../../core/ids.js';
import { navigate } from '../router.js';

const chatLog = [
  {
    role: 'bot',
    text: 'أهلًا! أنا مساعدك الدراسي في «يومي». 🤖\nأعمل ببياناتك الفعلية فقط — جدولك، مهامك، ومراجعاتك.\nاسألني مثلًا: «ماذا أذاكر اليوم؟» أو «فاتتني المذاكرة — رتب يومي».',
  },
];

const SUGGESTIONS = [
  'ماذا أذاكر اليوم؟',
  'فاتتني المذاكرة — رتب يومي',
  'كم وقت فراغ لدي اليوم؟',
  'ذكّرني بمراجعة الفلسفة غدًا',
  'أعِد لي خطة مراجعة للتاريخ',
  'لدي امتحان أسبوع قادم',
  'أرني المهام غير المنجزة',
  'اجعل الخميس يوم تعويض',
];

// إصلاح التكرار في الاقتراح الأول
SUGGESTIONS[0] = 'ماذا أذاكر اليوم؟';

export function renderAssistant() {
  return {
    html: `
      <h1>المساعد الذكي</h1>
      ${notice('info', 'يعمل المساعد محليًا بالكامل دون إنترنت، ويعتمد حصريًا على بياناتك المخزنة. لن يغيّر أي درس مؤكد دون موافقتك.')}

      <div class="card pad-lg">
        <div class="chat-box" id="chat-box">
          ${chatLog.map((m) => `
            <div class="chat-msg ${m.role}">${esc(m.text).replace(/\n/g, '<br>')}
              ${m.actions && m.actions.length ? `
                <div class="assistant-actions">
                  ${m.actions.map((a, i) => `<button class="btn btn-sm btn-primary" data-act="do-action" data-msg="${chatLog.indexOf(m)}" data-idx="${i}">${esc(a.label)}</button>`).join('')}
                </div>` : ''}
            </div>`).join('')}
        </div>

        <div class="chat-suggestions">
          ${SUGGESTIONS.map((s) => `<button class="chip chip-brand" data-act="suggest" data-text="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>

        <div class="chat-input-row">
          <input class="input" id="chat-input" placeholder="اكتب سؤالك هنا…" autocomplete="off">
          <button class="btn btn-primary" data-act="send">إرسال</button>
        </div>
      </div>

      <div class="card">
        <p class="small muted mb-0">
          💡 كل اقتراحات المساعد قابلة للمراجعة قبل التنفيذ. الإجراءات التي تمس الجدول تطلب موافقتك أولًا.
        </p>
      </div>
    `,
    onMount(root) {
      const input = root.querySelector('#chat-input');
      const box = root.querySelector('#chat-box');
      if (box) box.scrollTop = box.scrollHeight;

      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;

        if (act === 'suggest') {
          send(btn.dataset.text);
          return;
        }
        if (act === 'send') {
          const text = input.value.trim();
          if (!text) return;
          input.value = '';
          send(text);
          return;
        }
        if (act === 'do-action') {
          const msg = chatLog[parseInt(btn.dataset.msg, 10)];
          const action = msg?.actions?.[parseInt(btn.dataset.idx, 10)];
          if (action) await runAction(action);
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const text = input.value.trim();
          if (text) {
            input.value = '';
            send(text);
          }
        }
      });

      function send(text) {
        chatLog.push({ role: 'user', text });
        const reply = respond(text);
        chatLog.push({ role: 'bot', text: reply.text, actions: reply.actions || [] });
        import('../router.js').then((r) => r.requestRender());
      }
    },
  };
}

async function runAction(action) {
  try {
    if (action.kind === 'navigate') {
      navigate(action.payload);
      return;
    }
    if (action.kind === 'applyPlan') {
      const { iso, suggestions } = action.payload;
      const ok = await confirmDialog({
        title: 'تطبيق الخطة',
        message: 'سيتم إضافة ' + suggestions.length + ' فعاليات جديدة إلى جدول ' + fmtDayRel(iso) + '. لن يُغيَّر أي درس مؤكد. هل تريد المتابعة؟',
        okText: 'تطبيق',
      });
      if (!ok) return;
      const created = await applySuggestions(iso, suggestions);
      for (const ev of created) await putItem('events', ev);
      toast('أُضيفت ' + created.length + ' فعاليات ✓', 'ok');
      navigate('#/schedule');
      return;
    }
    if (action.kind === 'addReminder') {
      const task = createTask({
        title: action.payload.title,
        subject: action.payload.subject,
        dueAt: action.payload.dueAt,
        priority: 'medium',
        notes: 'أضافها المساعد الذكي',
      });
      await saveTask(task);
      // منبه مرافق
      await saveAlarm({
        id: 'al-' + uid(),
        category: 'revision',
        title: 'تذكير: ' + action.payload.title,
        message: 'وقت المراجعة المخطط.',
        time: action.payload.dueAt.slice(11, 16),
        days: [], repeat: 'once', date: action.payload.dueAt.slice(0, 10),
        enabled: true, sound: 'gentle', vibrate: true,
        snoozeEnabled: true, snoozeMinutes: 10,
      });
      toast('أُضيف التذكير والمنبه ✓', 'ok');
      return;
    }
    if (action.kind === 'createRevision') {
      const plan = createRevisionPlan({
        title: action.payload.title,
        subject: action.payload.subject,
      });
      await saveRevision(plan);
      toast('أُنشئت خطة المراجعة المتباعدة ✓', 'ok');
      navigate('#/account/tasks');
      return;
    }
  } catch (err) {
    toast('تعذّر التنفيذ: ' + String(err.message || err), 'err');
  }
}
