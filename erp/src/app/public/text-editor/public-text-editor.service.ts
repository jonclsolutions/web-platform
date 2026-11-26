/**
 * @file public-text-editor.service.ts
 * @path src/app/public/text-editor/public-text-editor.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor mode of the public website - the website shown in the frame of the visual
 *   text editor of the admin. Active only inside the frame of the editor on a page of the admin
 *   of the same origin; then it marks every text of the translations (LocalizationService) and
 *   of the content (WebContentService) with the invisible marks of its key, shows the Czech
 *   reference in place of a text missing in the language (orange), applies the unsaved
 *   texts sent by the admin (live preview), runs the overlay (outlines, selection) and talks to
 *   the admin with window messages (text-editor-protocol).
 * @usage `inject(PublicTextEditorService).active` - the cookie bar, the analytics and the language
 *   offer stay off in the editor; `decorate()` / `markContent()` by the text services.
 * @dependencies NgZone; text-editor-markers, text-editor-overlay, text-editor-protocol
 * @note Security: messages are accepted only from the parent window and from the own origin, and
 *   the editor mode needs a parent page of the admin of the same origin - another site cannot
 *   frame the website in editor mode (and the website may be framed only by itself, CSP
 *   frame-ancestors 'self'). The editor mode shows and sends nothing that is not public.
 * @note GDPR: no cookie bar, no analytics - a look of the administrator into the editor is not a visit.
 */

import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { markText } from './text-editor-markers';
import { TextEditorEntry, TextEditorOverlay } from './text-editor-overlay';
import {
  TEXT_EDITOR_CHANNEL, TEXT_EDITOR_FRAME_NAME, TEXT_EDITOR_HOST_PREFIX, TextEditorContentSection, isBannersQuery,
  TextEditorFromFrame, TextEditorToFrame, isTextEditorMessage,
} from './text-editor-protocol';

/** Leaves of the translations that are identifiers, not texts (never marked - code compares them). */
const NON_TEXT_LEAVES = new Set(['id', 'key']);
/** Key of a language of a text of the content (`cz`, `en`, `pt-br`). */
const LANGUAGE_KEY = /^[a-z]{2}(?:-[a-z]{2,4})?$/;

/** Saved texts of a language (sent by `commit`). */
export interface TextEditorCommit {
  lang: string;
  values: Record<string, string>;
}

/**
 * @description Whether a window is the frame of the visual text editor: named as its frame,
 *   inside a parent of the same origin whose page belongs to the admin.
 * @param win Window of the application.
 * @returns true only in the editor.
 */
export function isTextEditorFrame(win: Window): boolean {
  try {
    return win.name === TEXT_EDITOR_FRAME_NAME
      && win.parent !== win
      && win.parent.location.origin === win.location.origin
      && win.parent.location.pathname.startsWith(TEXT_EDITOR_HOST_PREFIX);
  } catch {
    // a parent of another origin cannot be read
    return false;
  }
}

/**
 * @description Value at a dot path.
 * @param target Object.
 * @param path `a.b.0.c`.
 * @returns The value, undefined when the path does not exist.
 */
export function getAtPath(target: any, path: string): unknown {
  return path.split('.').reduce((node: any, part) => (node == null ? undefined : node[part]), target);
}

/**
 * @description Sets a value at a dot path (creates the missing objects).
 * @param target Object.
 * @param path `a.b.0.c`.
 * @param value Value.
 */
export function setAtPath(target: any, path: string, value: string): void {
  const parts = path.split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    if (node[parts[i]] === null || typeof node[parts[i]] !== 'object') {
      node[parts[i]] = {};
    }
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

@Injectable({ providedIn: 'root' })
export class PublicTextEditorService {
  private readonly zone = inject(NgZone);

  /** The website runs in the frame of the visual text editor. */
  readonly active: boolean = typeof window !== 'undefined' && isTextEditorFrame(window);

  /**
   * The editor shows its page "Lišta cookies a nabídka jazyka" (`?jsw-editor=banners` when the
   * frame was opened): the cookie bar and the language offer are shown with their texts,
   * their buttons store nothing. Never outside the editor.
   */
  readonly banners: boolean = this.active && isBannersQuery(window.location.search);

  /** Entries of the marks: their number is the index. */
  private readonly entries: TextEditorEntry[] = [];
  private readonly textIndex = new Map<string, number>();
  private readonly contentIndex = new Map<TextEditorContentSection, number>();

  /** Unsaved texts of `draftLang`. */
  private drafts: Record<string, string> = {};
  private draftLang: string | null = null;
  /** Texts missing in `draftLang`: key → Czech reference shown in their place (orange). */
  private missing: Record<string, string> = {};
  /** Hover labels of the content sections (from the admin, in its language). */
  private contentLabels: Partial<Record<TextEditorContentSection, string>> = {};
  /** Prefix of the label of a missing text (from the admin). */
  private missingLabel = 'Missing';
  private readonly missingIndex = new Map<string, number>();
  private readonly contentMissingIndex = new Map<TextEditorContentSection, number>();
  private overlay: TextEditorOverlay | null = null;

  private readonly changesSource = new Subject<void>();
  /** The drafts changed - the translations must be shown again. */
  readonly changes$: Observable<void> = this.changesSource.asObservable();
  private readonly commitsSource = new Subject<TextEditorCommit>();
  /** The drafts were saved - they become the texts of the language (before `changes$`). */
  readonly commits$: Observable<TextEditorCommit> = this.commitsSource.asObservable();

  constructor() {
    if (!this.active) return;
    window.addEventListener('message', event => this.receive(event));
    const start = () => this.zone.runOutsideAngular(() => this.startOverlay());
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      setTimeout(start);
    }
  }

  /**
   * @description Translations as shown in the editor: the drafts of the language applied and every
   *   text marked with its key. Outside the editor the same object.
   * @param data Translations of a language (never changed).
   * @param lang Its translation code.
   * @returns A marked copy (a new object - the pages render again).
   */
  decorate(data: any, lang: string): any {
    if (!this.active || !data || typeof data !== 'object') {
      return data;
    }
    const copy = structuredClone(data);
    const missingPaths = new Set<string>();
    if (this.draftLang === lang) {
      for (const [path, value] of Object.entries(this.drafts)) {
        setAtPath(copy, path, value);
      }
      // a text still empty in the language shows its Czech reference (key when Czech lacks it too)
      for (const [path, reference] of Object.entries(this.missing)) {
        const current = getAtPath(copy, path);
        if (typeof current !== 'string' || !current.trim()) {
          setAtPath(copy, path, reference?.trim() ? reference : `[${path}]`);
          missingPaths.add(path);
        }
      }
    }
    return this.markTree(copy, '', missingPaths);
  }

  /**
   * @description Content of the admin as shown in the editor: every text of every language marked
   *   with its section (blue outline). Outside the editor the same list.
   * @param list Content list (FAQ categories, positions…).
   * @param section Its part of the admin.
   * @param missingText Placeholder of a text missing in a language ('Cannot load text') - in the
   *   editor it is marked as missing content (orange) when a page reads such a language.
   * @returns A marked copy.
   */
  markContent<T>(list: T, section: TextEditorContentSection, missingText = ''): T {
    if (!this.active) {
      return list;
    }
    const index = this.contentEntry(section);
    const missingIndex = this.contentMissingEntry(section);
    // a text per language: the languages it has are marked, any other language read by a page
    // gives the marked placeholder (`text[lang]` of localizedText())
    const asText = (marked: Record<string, string>) => new Proxy(marked, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'string' && LANGUAGE_KEY.test(prop) && missingText && !(typeof target[prop] === 'string' && target[prop].trim())) {
          return markText(missingText, missingIndex, 'content');
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const walk = (node: any): any => {
      if (Array.isArray(node)) {
        return node.map(walk);
      }
      if (node && typeof node === 'object') {
        const keys = Object.keys(node);
        const isText = keys.length > 0 && keys.every(k => LANGUAGE_KEY.test(k) && (typeof node[k] === 'string' || node[k] == null));
        const out: any = {};
        for (const key of keys) {
          // an empty text stays empty - the page reads it as missing (the placeholder above)
          out[key] = isText && typeof node[key] === 'string' ? (node[key].trim() ? markText(node[key], index, 'content') : node[key]) : walk(node[key]);
        }
        return isText ? asText(out) : out;
      }
      return node;
    };
    return walk(list) as T;
  }

  /**
   * @description Entry of a number found in a mark (the overlay).
   * @param index Number.
   * @returns The entry, undefined for an unknown number.
   */
  entry(index: number): TextEditorEntry | undefined {
    return this.entries[index];
  }

  // ── Internals ───────────────────────────────────────────────

  /** @returns Number of the entry of a translation key (created once). */
  private textEntry(key: string): number {
    let index = this.textIndex.get(key);
    if (index === undefined) {
      index = this.entries.push({ kind: 'text', key }) - 1;
      this.textIndex.set(key, index);
    }
    return index;
  }

  /** @returns Number of the entry of a text missing in the language (created once). */
  private missingEntry(key: string): number {
    let index = this.missingIndex.get(key);
    if (index === undefined) {
      index = this.entries.push({ kind: 'text', key, missing: true }) - 1;
      this.missingIndex.set(key, index);
    }
    return index;
  }

  /** @returns Number of the entry of missing content of a section (created once). */
  private contentMissingEntry(section: TextEditorContentSection): number {
    let index = this.contentMissingIndex.get(section);
    if (index === undefined) {
      index = this.entries.push({ kind: 'content', section, missing: true }) - 1;
      this.contentMissingIndex.set(section, index);
    }
    return index;
  }

  /** @returns Number of the entry of a content section (created once). */
  private contentEntry(section: TextEditorContentSection): number {
    let index = this.contentIndex.get(section);
    if (index === undefined) {
      index = this.entries.push({ kind: 'content', section }) - 1;
      this.contentIndex.set(section, index);
    }
    return index;
  }

  /**
   * @description Marks every string leaf of the translations with its dot path (identifiers excepted).
   * @param node Subtree (changed in place).
   * @param path Its dot path.
   * @param missingPaths Texts shown in place of missing ones (marked as missing).
   */
  private markTree(node: any, path: string, missingPaths: Set<string>): any {
    if (typeof node === 'string') {
      const leaf = path.slice(path.lastIndexOf('.') + 1);
      if (NON_TEXT_LEAVES.has(leaf)) return node;
      return markText(node, missingPaths.has(path) ? this.missingEntry(path) : this.textEntry(path), 'text');
    }
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        node[key] = this.markTree(node[key], path ? `${path}.${key}` : key, missingPaths);
      }
    }
    return node;
  }

  /** @description Starts the overlay and tells the admin the page is ready. */
  private startOverlay(): void {
    if (this.overlay || !document.body) return;
    this.overlay = new TextEditorOverlay(document, {
      entry: index => this.entry(index),
      contentLabel: section => this.contentLabels[section] ?? section,
      missingLabel: () => this.missingLabel,
      onSelect: key => this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'select', key }),
      onContent: section => this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'content', section }),
      onScan: scan => this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'scan', ...scan }),
    });
    this.overlay.start();
    this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'ready' });
  }

  /**
   * @description Handles a message of the admin (only from the parent window of the own origin).
   * @param event Window message.
   */
  private receive(event: MessageEvent): void {
    if (event.source !== window.parent || event.origin !== window.location.origin || !isTextEditorMessage(event.data)) {
      return;
    }
    const message = event.data as TextEditorToFrame;
    this.zone.run(() => {
      switch (message.type) {
        case 'init':
          this.contentLabels = message.contentLabels ?? {};
          this.missingLabel = message.missingLabel || this.missingLabel;
          this.missing = { ...(message.missing ?? {}) };
          this.setDrafts(message.lang, message.drafts);
          this.overlay?.select(message.selected, false);
          break;
        case 'drafts':
          if (message.missing) {
            this.missing = { ...message.missing };
          }
          this.setDrafts(message.lang, message.values);
          break;
        case 'select':
          this.overlay?.select(message.key, message.reveal);
          break;
        case 'commit':
          if (this.draftLang) {
            this.commitsSource.next({ lang: this.draftLang, values: { ...this.drafts } });
          }
          this.drafts = {};
          this.changesSource.next();
          break;
      }
    });
  }

  /**
   * @description Replaces the drafts and shows the texts again.
   * @param lang Language of the drafts.
   * @param values Unsaved texts by key.
   */
  private setDrafts(lang: string, values: Record<string, string> | null | undefined): void {
    this.draftLang = lang;
    this.drafts = { ...(values ?? {}) };
    this.changesSource.next();
  }

  /**
   * @description Sends a message to the admin (only to the own origin).
   * @param message Message.
   */
  private post(message: TextEditorFromFrame): void {
    window.parent.postMessage(message, window.location.origin);
  }
}
