/**
 * @file text-editor-protocol.ts
 * @path src/app/public/text-editor/text-editor-protocol.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Messages between the visual text editor of the admin (the parent page) and the
 *   public website shown in its frame (editor mode, PublicTextEditorService). Both sides are the
 *   same application on the same origin; every message carries TEXT_EDITOR_CHANNEL and is
 *   accepted only from the other side's window and from the own origin.
 * @usage Admin: `frame.contentWindow.postMessage({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', … },
 *   location.origin)`; the frame answers with `scan`, `select` and `content`.
 * @dependencies none
 */

/** Channel id of every message (other messages of the window are ignored). */
export const TEXT_EDITOR_CHANNEL = 'jsw-text-editor';

/**
 * Name of the frame of the editor (`<iframe name>`) - kept by the frame across its own
 * navigations and reloads, so the public application knows it runs in the editor.
 */
export const TEXT_EDITOR_FRAME_NAME = 'jsw-text-editor-frame';

/** Path prefix of the pages allowed to host the editor (the admin). */
export const TEXT_EDITOR_HOST_PREFIX = '/admin/';

/**
 * Query of the page "Lišta cookies a nabídka jazyka" of the editor (`/?jsw-editor=banners`): the
 * website shows the cookie bar and the language offer (otherwise never in the editor) so their
 * texts can be clicked; their buttons store nothing.
 */
export const TEXT_EDITOR_BANNERS_PARAM = 'jsw-editor';
export const TEXT_EDITOR_BANNERS_VALUE = 'banners';
/** Path of that page (without the language). */
export const TEXT_EDITOR_BANNERS_PATH = `/?${TEXT_EDITOR_BANNERS_PARAM}=${TEXT_EDITOR_BANNERS_VALUE}`;

/**
 * @description Whether an address asks for the cookie bar and the language offer of the editor.
 * @param search `location.search`.
 * @returns true for `?jsw-editor=banners`.
 */
export function isBannersQuery(search: string): boolean {
  return new URLSearchParams(search).get(TEXT_EDITOR_BANNERS_PARAM) === TEXT_EDITOR_BANNERS_VALUE;
}

/** Sections of the content of the website managed in the admin (blue outlines). */
export type TextEditorContentSection = 'faq' | 'jobs' | 'references' | 'knowledge_base';

/** A text of the page that cannot be clicked (attribute, hidden by CSS). */
export interface TextEditorHiddenText {
  /** Dot path of the translation key. */
  key: string;
  /** Where it is: an attribute (`placeholder`, `alt`, `title`, `aria-label`, `content`), `option`
   *  (of a drop-down list) or `hidden` (not shown at this screen size). */
  where: string;
}

/** Admin → frame. */
export type TextEditorToFrame =
  /**
   * First message after `ready`: hover labels (content, "missing"), the drafts, the texts missing
   * in the language (key → Czech reference, shown in their place) and the selected key.
   */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'init'; lang: string; drafts: Record<string, string>; missing: Record<string, string>; selected: string | null; contentLabels: Partial<Record<TextEditorContentSection, string>>; missingLabel: string }
  /**
   * Shows another page inside the running website (no new load - faster): its URL with the
   * language (`/cs/faq`). A new language or the page of the banners loads the frame again.
   */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'navigate'; url: string }
  /** Unsaved texts of a language (whole set - replaces the previous one; empty = none); with the
   *  texts missing in it when they changed. */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'drafts'; lang: string; values: Record<string, string>; missing?: Record<string, string> }
  /** Highlight a key (null = nothing); `reveal` scrolls the page to it. */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'select'; key: string | null; reveal: boolean }
  /** Texts of a language were saved (key → text as stored) - they become the texts of the page. */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'commit'; lang: string; values: Record<string, string> };

/** Frame → admin. */
export type TextEditorFromFrame =
  /** The page of the frame is running in editor mode and waits for `init`. */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'ready' }
  /**
   * What the page shows: its path (without language), the language of its URL (translation code,
   * null without one), title, clickable, missing (shown) and hidden keys.
   */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'scan'; path: string; lang?: string | null; title: string; visible: string[]; missing: string[]; hidden: TextEditorHiddenText[] }
  /** A text was clicked. */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'select'; key: string }
  /** Content of the admin was clicked (FAQ question, reference…). */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'content'; section: TextEditorContentSection }
  /** A shortcut pressed in the page: Ctrl/Cmd+S (save) or Esc (cancel the selection). */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'key'; key: TextEditorShortcut }
  /**
   * The language switcher of the page was used: the admin switches the language of the editor
   * (asking first about unsaved edits) - the page itself does not change its language.
   */
  | { channel: typeof TEXT_EDITOR_CHANNEL; type: 'language'; code: string };

/** Shortcuts of the editor the page passes on (its keys never reach the window of the admin). */
export type TextEditorShortcut = 'save' | 'escape';

/**
 * @description Whether a received message belongs to the editor.
 * @param data `MessageEvent.data`.
 * @returns true for an object of TEXT_EDITOR_CHANNEL with a type.
 */
export function isTextEditorMessage(data: unknown): data is { channel: string; type: string } {
  return !!data && typeof data === 'object'
    && (data as { channel?: unknown }).channel === TEXT_EDITOR_CHANNEL
    && typeof (data as { type?: unknown }).type === 'string';
}
