/* ============================================================
 * notifications.js — مركز الإشعارات داخل التطبيق
 * ============================================================ */

import { esc, confirmDialog, toast } from '../dom.js';
import { emptyState, notice, sectionHeader } from '../components.js';
import { state, markNotificationRead, markAllNotificationsRead, putItem, deleteItem } from '../../core/store.js';
import { fmtRel } from '../../core/format.js';
import { navigate } from '../router.js';

export function renderNotifications() {
  const list = [...state.notifications].sort((a, b) => b.createdAt - a.createdAt);
  const unread = list.filter((n) => !n.read);

  return {
    html: `
      <div class="row-between" style="margin-bottom:10px">
        <h1 style="margin:0">مركز الإشعارات</h1>
        ${unread.length ? '<button class="btn btn-sm btn-ghost" data-act="read-all">تعليم الكل كمقروء</button>' : ''}
      </div>

      ${unread.length ? notice('info', 'لديك <strong>' + unread.length + '</strong> إشعارات جديدة.') : ''}

      ${list.length ? list.map((n) => `
        <div class="card" style="${n.read ? 'opacity:.7' : 'border-inline-start:4px solid var(--brand)'}">
          <div class="row-between">
            <div style="flex:1;min-width:0">
              <div class="row" style="gap:6px">
                ${levelIcon(n.level)}
                <strong>${esc(n.title)}</strong>
              </div>
              ${n.body ? `<div class="small muted" style="margin-top:2px">${esc(n.body)}</div>` : ''}
              <div class="xsmall muted mt-1">${fmtRel(Math.round((Date.now() - n.createdAt) / 60000))}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${actionButton(n)}
              ${!n.read ? `<button class="btn btn-sm btn-ghost" data-act="read" data-id="${esc(n.id)}">✓</button>` : ''}
              <button class="btn btn-sm btn-ghost" data-act="dismiss" data-id="${esc(n.id)}">✕</button>
            </div>
          </div>
        </div>`).join('')
      : emptyState('🔔', 'لا توجد إشعارات', 'ستظهر هنا تذكيرات الدروس والمنبهات والمهام ورسائل الإنجاز.')}

      <div class="card">
        <p class="small muted mb-0">
          تتحكم في كثافة التذكيرات وساعات الهدوء من «الإعدادات ← التنبيهات والإشعارات».
          لا نرسل إشعارات مزعجة: كل رسالة هنا لها سبب واضح وإجراء مفيد.
        </p>
      </div>
    `,
    onMount(root) {
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        const id = btn.dataset.id;

        if (act === 'read-all') {
          await markAllNotificationsRead();
          import('../router.js').then((r) => r.requestRender());
        } else if (act === 'read') {
          await markNotificationRead(id);
          import('../router.js').then((r) => r.requestRender());
        } else if (act === 'dismiss') {
          await deleteItem('notifications', id);
          import('../router.js').then((r) => r.requestRender());
        } else if (act === 'open-action') {
          const n = state.notifications.find((x) => x.id === id);
          if (n) {
            await markNotificationRead(id);
            if (n.actionType === 'alarm') navigate('#/alarms');
            else if (n.actionType === 'task') navigate('#/account/tasks');
            else if (n.actionType === 'event') navigate('#/schedule');
            else if (n.actionType === 'study') navigate('#/study');
            else navigate('#/home');
          }
        }
      });
    },
  };
}

function levelIcon(level) {
  const map = { info: 'ℹ️', warn: '⚠️', error: '⛔', success: '✅' };
  return '<span>' + (map[level] || 'ℹ️') + '</span>';
}

function actionButton(n) {
  if (!n.actionType) return '';
  const labels = { alarm: 'فتح المنبهات', task: 'فتح المهام', event: 'فتح الجدول', study: 'بدء مذاكرة' };
  return `<button class="btn btn-sm btn-soft" data-act="open-action" data-id="${esc(n.id)}">${labels[n.actionType] || 'فتح'}</button>`;
}
