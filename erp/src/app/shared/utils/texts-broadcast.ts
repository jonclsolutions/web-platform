/**
 * @file texts-broadcast.ts
 * @path src/app/shared/utils/texts-broadcast.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Tells the open tabs of the website in the same browser that the admin saved its
 *   texts or changed its languages, so they show them at once (without a reload): the translation
 *   editors announce, the public LocalizationService listens.
 * @usage `announceTexts({ kind: 'texts', module: 'web', lang: 'cz' })`;
 *   `const stop = listenTexts(change => …); stop();`
 * @dependencies BroadcastChannel (same origin, same browser profile)
 * @note Only within the browser - nothing leaves it (no server, no data of visitors; GDPR). Other
 *   devices and visitors get the new texts with their next page load, as before.
 * @note Without BroadcastChannel (an old browser, a blocked context) nothing happens.
 */

/** Name of the channel. */
export const TEXTS_CHANNEL = 'jsw-texts';

/** A change of the texts of a module: the texts of one language, or its languages. */
export type TextsChange =
  | { kind: 'texts'; module: string; lang: string }
  | { kind: 'languages'; module: string };

/** @returns A channel, or null when the browser has none. */
function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'function' ? new BroadcastChannel(TEXTS_CHANNEL) : null;
  } catch {
    return null;
  }
}

/**
 * @description Announces a change to the other tabs (the sending tab gets nothing back).
 * @param change What changed.
 */
export function announceTexts(change: TextsChange): void {
  const channel = openChannel();
  if (!channel) return;
  try {
    channel.postMessage(change);
  } finally {
    channel.close();
  }
}

/**
 * @param value Data of a message.
 * @returns Whether it is a valid change (module / language codes only - nothing else is trusted).
 */
export function isTextsChange(value: unknown): value is TextsChange {
  const data = value as Partial<{ kind: string; module: string; lang: string }> | null;
  if (!data || typeof data !== 'object' || typeof data.module !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(data.module)) {
    return false;
  }
  if (data.kind === 'languages') return true;
  return data.kind === 'texts' && typeof data.lang === 'string' && /^[a-z]{2}(-[a-z]{2})?$/.test(data.lang);
}

/**
 * @description Listens to the changes announced by other tabs.
 * @param handler Called with each valid change.
 * @returns Stops listening.
 */
export function listenTexts(handler: (change: TextsChange) => void): () => void {
  const channel = openChannel();
  if (!channel) return () => undefined;
  channel.onmessage = event => {
    if (isTextsChange(event.data)) handler(event.data);
  };
  return () => channel.close();
}
