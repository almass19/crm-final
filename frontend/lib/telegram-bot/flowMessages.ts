import { deleteTelegramMessages } from '@/lib/telegram';

// The "new creative" flow leaves a trail of prompts, client lists and typed
// answers in the chat. Their ids ride along in the bot state context and are
// deleted in one go when the flow ends, so the chat only keeps the result.
// Brief messages are NOT tracked here — they're forwarded to designers by id
// for every later request, so they must stay.
const FLOW_MESSAGES_KEY = 'flowMessageIds';

export function getFlowMessageIds(context: Record<string, unknown> | undefined): number[] {
  const ids = context?.[FLOW_MESSAGES_KEY];
  return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];
}

// Returns a new context with the given ids appended (nulls from failed sends
// are dropped).
export function withFlowMessages(
  context: Record<string, unknown> | undefined,
  ...ids: Array<number | null | undefined>
): Record<string, unknown> {
  const added = ids.filter((id): id is number => typeof id === 'number');
  return { ...context, [FLOW_MESSAGES_KEY]: [...getFlowMessageIds(context), ...added] };
}

export async function deleteFlowMessages(chatId: number, ids: number[]): Promise<void> {
  if (ids.length > 0) await deleteTelegramMessages(chatId, ids);
}
