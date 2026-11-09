// Persistent reply-keyboard button labels, shared between the places that
// send them and the router logic that matches incoming text against them.
export const NEW_CREATIVE_BUTTON = '🎨 Новый креатив';
export const MY_REQUESTS_BUTTON = '📋 Мои заявки';
export const MY_TASKS_BUTTON = '📋 Мои задачи';
export const CANCEL_BUTTON = '❌ Отмена';

export const IDLE_TARGETOLOGIST_KEYBOARD = [[NEW_CREATIVE_BUTTON, MY_REQUESTS_BUTTON]];
export const IDLE_DESIGNER_KEYBOARD = [[MY_TASKS_BUTTON]];
export const CANCEL_KEYBOARD = [[CANCEL_BUTTON]];

export const DESIGNER_ROLES = ['DESIGNER', 'LEAD_DESIGNER'];

// The keyboard a user sits on between flows, or null for roles the bot has
// no actions for.
export function idleKeyboardFor(role: string | null): string[][] | null {
  if (role === 'TARGETOLOGIST') return IDLE_TARGETOLOGIST_KEYBOARD;
  if (role && DESIGNER_ROLES.includes(role)) return IDLE_DESIGNER_KEYBOARD;
  return null;
}
