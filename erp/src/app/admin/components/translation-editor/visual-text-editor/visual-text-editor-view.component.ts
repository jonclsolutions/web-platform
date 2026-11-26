/**
 * @file visual-text-editor-view.component.ts
 * @path src/app/admin/components/translation-editor/visual-text-editor/visual-text-editor-view.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Visual text editor of a public application (full screen): the real page of the
 *   website in a frame (its editor mode outlines every text with its key), a top bar (EDITOR,
 *   page, language, Zahodit změny / Uložit, close) and a side panel with the selected text -
 *   its key, the Czech reference, the saved version and the field for the edit. Edits show on the
 *   page at once and reach the website after Uložit; content of the admin (FAQ, references…)
 *   points to its part. A text missing in the language shows its Czech reference (orange) and is
 *   listed in the panel; every language is offered (a switched off one with a notice and its
 *   switch-on) and the window "Jazyky" manages them as on the list of the texts. The preview
 *   switches between the desktop and a phone (390 px - the mobile layout of the website). The translation state, saving and discarding are those of the
 *   translation editor of the module (`e`, BaseTranslationEditorComponent).
 * @usage `<app-visual-text-editor-view [e]="this" [pages]="pages" backRoute="/admin/web/edit-website" />`
 *   in a page component that extends BaseTranslationEditorComponent.
 * @dependencies BaseTranslationEditorComponent, AdminModalComponent, text-editor-protocol,
 *   language-url, table-cards (phone limit)
 * @note Not on a phone (≤ 640 px): a notice with the way back instead of the editor.
 * @note Leaving with unsaved edits asks first: in the editor (language, discard) and on any way
 *   out of the page (`confirmLeave` - unsavedTextsGuard of the route: Back, close, links).
 * @note Security: the frame shows the own website (same origin, path checked) in a sandbox
 *   without forms, pop-ups and navigation of the admin; messages are accepted only from the
 *   window of the frame and the own origin.
 */

import {
  AfterViewInit, ChangeDetectorRef, Component, DestroyRef, DoCheck, ElementRef, HostListener, Input, NgZone, OnDestroy,
  OnInit, ViewChild, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BaseTranslationEditorComponent, FlatKey, LangMeta } from '../base-translation-editor.component';
import { AdminModalComponent } from '../../admin-modal/admin-modal.component';
import { TranslationLanguagesComponent } from '../translation-languages/translation-languages.component';
import { phoneQuery } from '../../builders/table-cards';
import { withLanguagePrefix } from '../../../../shared/utils/language-url';
import {
  TEXT_EDITOR_CHANNEL, TEXT_EDITOR_FRAME_NAME, TextEditorContentSection, TextEditorFromFrame,
  TextEditorHiddenText, TextEditorShortcut, TextEditorToFrame, isTextEditorMessage,
} from '../../../../public/text-editor/text-editor-protocol';

/** A page of the website offered in the editor. */
export interface VisualEditorPage {
  /** Path without the language (`/`, `/faq`; `/?jsw-editor=banners` = the cookie bar and the language offer). */
  path: string;
  /** Key of its name (`e.t()`). */
  labelKey: string;
}

/** Preview of the page: the full width of the stage, or the width of a phone. */
export type VisualEditorDevice = 'desktop' | 'mobile';

/** Width of the phone preview (CSS px - a common phone, the mobile layout of the website). */
export const MOBILE_PREVIEW_WIDTH = 390;

/** localStorage key of the chosen preview (a preference of the admin user, no personal data). */
export const DEVICE_STORAGE_KEY = 'jsw_text_editor_device';

/** Changed texts listed before "zobrazit všechny". */
export const CHANGED_LIST_LIMIT = 6;

/** Other texts of the page listed before "zobrazit všechny". */
export const HIDDEN_LIST_LIMIT = 6;

/** Order of the groups of the other texts of the page (by where they are). */
const HIDDEN_ORDER = ['hidden', 'aria-label', 'placeholder', 'value', 'alt', 'title', 'option', 'content'];

/** The browser title of a page whose own title is not set yet (index.html - on purpose, no default). */
export const PAGE_TITLE_PLACEHOLDER = 'Loading';

/** Time after which a page still showing the placeholder title has no title of its own (ms). */
export const PAGE_TITLE_WAIT_MS = 3000;

/** Time the quiet "Uloženo" stays by the save button (ms). */
export const SAVED_NOTICE_MS = 3000;

/** Sections of the content and the tab of the admin that edits them. */
const CONTENT_SECTIONS: TextEditorContentSection[] = ['faq', 'jobs', 'references', 'knowledge_base'];

/**
 * @description Path of the own website that may be shown in the frame.
 * @param path Path from the page list or from the frame.
 * @returns The path; `/` for anything else (another origin, protocol, `//host`).
 */
export function safeFramePath(path: string | null | undefined): string {
  return typeof path === 'string' && /^\/(?![/\\])[^\s:]*$/.test(path) ? path : '/';
}

@Component({
  selector: 'app-visual-text-editor-view',
  standalone: true,
  imports: [FormsModule, AdminModalComponent, TranslationLanguagesComponent],
  templateUrl: './visual-text-editor-view.component.html',
  styleUrls: ['../../../shared-styles/theme.css', '../../../../shared/styles/base.css', '../../../shared-styles/modal.css', './visual-text-editor-view.component.css'],
})
export class VisualTextEditorViewComponent implements OnInit, AfterViewInit, DoCheck, OnDestroy {
  /** Translation editor of the module (state, saving, discarding, texts of the page). */
  @Input({ required: true }) e!: BaseTranslationEditorComponent;
  /** Pages of the website offered in the page list. */
  @Input() pages: VisualEditorPage[] = [];
  /** Page of the admin the editor returns to (the list of the texts). */
  @Input() backRoute = '';

  @ViewChild('frame') private frameRef?: ElementRef<HTMLIFrameElement>;
  @ViewChild('valueField') private valueField?: ElementRef<HTMLTextAreaElement>;

  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Name of the frame (the website knows it runs in the editor). */
  readonly frameName = TEXT_EDITOR_FRAME_NAME;
  /** Phone - no editor, a notice instead. */
  isPhone = false;
  /** The page of the frame is loading. */
  frameLoading = true;
  /** Path of the page shown (without the language). */
  framePath = '/';
  /** Browser title of the page shown. */
  pageTitle = '';
  /** Keys of the texts the page shows. */
  visibleKeys: string[] = [];
  /** Texts of the page that cannot be clicked (attributes, hidden). */
  hiddenTexts: TextEditorHiddenText[] = [];
  /** Keys of the texts missing in the language that the page shows (Czech reference in place). */
  missingKeys: string[] = [];
  /** The window "Jazyky" is open. */
  languagesOpen = false;
  /** The other texts of the page show all of them (else the first HIDDEN_LIST_LIMIT). */
  hiddenExpanded = false;
  /** The quiet "Uloženo" by the save button (after a save). */
  savedNotice = false;
  /** The page still has the placeholder title after PAGE_TITLE_WAIT_MS - it has no title of its own. */
  titleMissing = false;
  private titleTimer: ReturnType<typeof setTimeout> | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  /** Preview of the page (the last choice is remembered). */
  device: VisualEditorDevice = readDevice();
  /** Width of the phone preview (template). */
  readonly mobileWidth = MOBILE_PREVIEW_WIDTH;
  /** Selected text (key), null = none. */
  selectedKey: string | null = null;
  /** Clicked content of the admin, null = none. */
  contentSection: TextEditorContentSection | null = null;
  /** Action waiting for the confirmation to throw away the unsaved edits. */
  pendingAction: (() => void) | null = null;
  /** Called when the confirmation is answered "keep" (leaving the page: stay). */
  private pendingCancel: (() => void) | null = null;
  /** The confirmation is about leaving the editor (its own texts: stay / leave without saving). */
  pendingLeave = false;

  /** Language of the page shown in the frame (a deleted language switches the page to Czech). */
  private frameLang = '';
  /** Languages (code / state) when last seen - an added / deleted / switched language reloads the page. */
  private languagesSeen = '';
  /** Texts of the language when last sent (a reload of the texts sends the missing ones again). */
  private keysSeen: FlatKey[] | null = null;
  /** Message of the JSON upload when last seen (an upload of the open language reloads the page). */
  private uploadSeen = '';
  private phone: MediaQueryList | null = null;
  private readonly onPhoneChange = (event: MediaQueryListEvent) => this.zone.run(() => {
    this.isPhone = event.matches;
    this.cd.markForCheck();
    if (!this.isPhone) setTimeout(() => this.navigateFrame(this.framePath));
  });
  private readonly onMessage = (event: MessageEvent) => this.receive(event);

  /** @description Phone check, messages of the frame, handing the drafts over after a save. */
  ngOnInit(): void {
    this.phone = phoneQuery();
    this.isPhone = !!this.phone?.matches;
    this.phone?.addEventListener('change', this.onPhoneChange);
    window.addEventListener('message', this.onMessage);
    // a window after saving would cover the bar of the editor - a quiet "Uloženo" by the button
    this.e.saveAlert = false;
    this.e.saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'commit' });
      this.showSavedNotice();
    });
  }

  /** @description Opens the first page of the list in the frame. */
  ngAfterViewInit(): void {
    if (!this.isPhone) {
      this.navigateFrame(this.pages[0]?.path ?? '/');
    }
  }

  /**
   * @description Follows the languages and texts of the editor changed in the window "Jazyky":
   *   a deleted open language (Czech is opened), an added / deleted / switched language or an
   *   uploaded JSON of the open language reload the page; reloaded texts send the missing ones.
   */
  ngDoCheck(): void {
    if (this.isPhone || !this.frameRef) return;
    const languages = this.e.languages.map(lang => `${lang.code}:${lang.active ? 1 : 0}`).join(',');
    const uploaded = this.e.showUploadModal && this.e.uploadSuccess && this.e.uploadLangCode === this.e.currentLang ? this.e.uploadSuccess : '';
    const reload = this.e.currentLang !== this.frameLang
      || (this.languagesSeen !== '' && languages !== this.languagesSeen)
      || (uploaded !== '' && uploaded !== this.uploadSeen);
    this.languagesSeen = languages;
    this.uploadSeen = uploaded;
    if (reload && this.frameLang !== '') {
      this.navigateFrame(this.framePath);
    }
    if (this.e.flattenedKeys !== this.keysSeen) {
      this.keysSeen = this.e.flattenedKeys;
      this.postDrafts();
    }
  }

  /** @description Stops listening. */
  ngOnDestroy(): void {
    this.e.saveAlert = true;
    if (this.titleTimer) clearTimeout(this.titleTimer);
    if (this.savedTimer) clearTimeout(this.savedTimer);
    window.removeEventListener('message', this.onMessage);
    this.phone?.removeEventListener('change', this.onPhoneChange);
  }

  /**
   * @description The browser asks before closing / reloading the tab with unsaved edits.
   * @param event beforeunload.
   */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.shortcut('save');
    } else if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.shortcut('escape');
    }
  }

  /**
   * @description Shortcuts of the editor (also pressed in the page of the frame): Ctrl/Cmd+S
   *   saves the edits, Esc cancels the selected text / content. Not while a window of the editor
   *   is open (it has its own keys) and not on a phone.
   * @param key Shortcut.
   */
  shortcut(key: TextEditorShortcut): void {
    if (this.isPhone || this.pendingAction || this.languagesOpen || this.e.showAddForm || this.e.showUploadModal || this.e.langToDelete) {
      return;
    }
    if (key === 'save') {
      if (this.e.canUpdate && this.e.isDirty) this.save();
      return;
    }
    if (this.selectedKey || this.contentSection) {
      this.selectedKey = null;
      this.contentSection = null;
      this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'select', key: null, reveal: false });
      this.cd.markForCheck();
    }
  }

  /** @description The quiet "Uloženo" by the save button for a moment. */
  private showSavedNotice(): void {
    this.savedNotice = true;
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      this.savedNotice = false;
      this.cd.markForCheck();
    }, SAVED_NOTICE_MS);
    this.cd.markForCheck();
  }

  /**
   * @returns Whether the page shows the placeholder title (index.html) - it is loading, or it
   *   has no title of its own (`titleMissing`).
   */
  get titlePending(): boolean {
    return !this.pageTitle || this.pageTitle.trim() === PAGE_TITLE_PLACEHOLDER;
  }

  /**
   * @returns The other texts of the page in groups by where they are (hidden at this screen
   *   size, for screen readers, empty fields…); the first HIDDEN_LIST_LIMIT unless expanded.
   */
  get hiddenGroups(): { where: string; label: string; keys: string[] }[] {
    const rank = (where: string) => { const index = HIDDEN_ORDER.indexOf(where); return index < 0 ? HIDDEN_ORDER.length : index; };
    const sorted = [...this.hiddenTexts].sort((a, b) => rank(a.where) - rank(b.where));
    const shown = this.hiddenExpanded ? sorted : sorted.slice(0, HIDDEN_LIST_LIMIT);
    const groups: { where: string; label: string; keys: string[] }[] = [];
    for (const text of shown) {
      let group = groups.find(g => g.where === text.where);
      if (!group) {
        group = { where: text.where, label: this.whereLabel(text.where), keys: [] };
        groups.push(group);
      }
      group.keys.push(text.key);
    }
    return groups;
  }

  /**
   * @param where Place of the other texts.
   * @returns How many texts of the page are there (the count of the group, also the cut ones).
   */
  hiddenCount(where: string): number {
    return this.hiddenTexts.filter(text => text.where === where).length;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.e.isDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ── Page, language, leaving ─────────────────────────────────

  /** @returns The current language when it is switched off (visitors do not see it), else null. */
  get inactiveLang(): LangMeta | null {
    const lang = this.e.getCurrentLangMeta();
    return lang && !lang.active && !lang.isBuiltIn ? lang : null;
  }

  /** @description Switches the open (switched off) language on - visitors see it at once. */
  activateLang(): void {
    const lang = this.inactiveLang;
    if (lang && this.e.canUpdate) {
      this.e.toggleLangActive(lang);
    }
  }

  /**
   * @description Switches the preview between the desktop and a phone - the same page and texts,
   *   the website lays itself out for the width of the frame (its mobile menu, columns…).
   * @param device Preview.
   */
  setDevice(device: VisualEditorDevice): void {
    if (device === this.device) return;
    this.device = device;
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, device);
    } catch {
      // storage blocked - the choice holds for this visit only
    }
  }

  /** @description Opens the window "Jazyky" (the same as on the list of the texts). */
  openLanguages(): void {
    this.languagesOpen = true;
  }

  /** @description Closes the window "Jazyky". */
  closeLanguages(): void {
    this.languagesOpen = false;
  }

  /** @returns Name of the current language. */
  get langName(): string {
    return this.e.getCurrentLangMeta()?.name ?? this.e.currentLang.toUpperCase();
  }

  /** @returns Whether the page shown is one of the list (else "other page"). */
  get knownPage(): boolean {
    return this.pages.some(page => page.path === this.framePath);
  }

  /** @returns Label of the save button with the count of the edits. */
  get saveLabel(): string {
    const count = this.e.changedPaths.size;
    return count > 0 ? this.e.t('save_changes_count').replace('{count}', String(count)) : this.e.t('save_changes_button');
  }

  /**
   * @description Shows another page of the website (the edits stay).
   * @param path Path without the language.
   */
  goToPage(path: string): void {
    this.selectedKey = null;
    this.contentSection = null;
    this.navigateFrame(path);
  }

  /**
   * @description Switches the language of the texts and of the page - after a confirmation when
   *   there are unsaved edits (they belong to the language).
   * @param code Language code.
   */
  switchLang(code: string): void {
    if (code === this.e.currentLang) return;
    this.guard(() => {
      this.e.loadLang(code);
      this.navigateFrame(this.framePath);
    });
  }

  /** @description Back to the list of the texts (unsaved edits: the route asks, `confirmLeave`). */
  close(): void {
    this.router.navigateByUrl(this.backRoute);
  }

  /**
   * @description Opens a part of the admin (content tab, page titles); unsaved edits: the route
   *   asks (`confirmLeave`).
   * @param tab Key of the tab of the text editor page.
   */
  openTab(tab: string): void {
    this.router.navigate([this.backRoute], { queryParams: { tab } });
  }

  /**
   * @description Leaving the editor by any way (the Back button, close, a link to a part) -
   *   unsavedTextsGuard: at once without unsaved edits, otherwise after the confirmation.
   * @returns true = leave, false = stay.
   */
  confirmLeave(): boolean | Promise<boolean> {
    if (!this.e.isDirty) {
      return true;
    }
    this.cancelPending();
    return new Promise<boolean>(resolve => {
      this.pendingLeave = true;
      this.pendingAction = () => resolve(true);
      this.pendingCancel = () => resolve(false);
      this.cd.markForCheck();
    });
  }

  /** @description Saves the texts of the language (the page keeps them, see `saved$`). */
  save(): void {
    this.e.onSubmit();
  }

  /** @description Throws the edits away after a confirmation. */
  askDiscard(): void {
    this.pendingAction = () => {
      this.e.discardChanges();
      this.postDrafts();
    };
  }

  /** @description Runs the confirmed action (the edits are lost). */
  confirmPending(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    this.pendingCancel = null;
    this.pendingLeave = false;
    action?.();
  }

  /** @description Keeps the edits, nothing happens (leaving the page: stays). */
  cancelPending(): void {
    const cancel = this.pendingCancel;
    this.pendingAction = null;
    this.pendingCancel = null;
    this.pendingLeave = false;
    cancel?.();
  }

  /** @returns Text of the confirmation: how many edits of which language are lost. */
  get pendingMessage(): string {
    return this.e.t(this.pendingLeave ? 'editor_leave_message' : 'discard_confirm_message')
      .replace('{count}', String(this.e.changedPaths.size))
      .replace('{lang}', this.langName);
  }

  // ── Texts ───────────────────────────────────────────────────

  /**
   * @description Selects a text from the panel (a text of the page that cannot be clicked).
   * @param key Translation key.
   */
  selectKey(key: string): void {
    this.selectedKey = key;
    this.contentSection = null;
    this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'select', key, reveal: true });
    this.focusField();
  }

  /**
   * @param path Translation key.
   * @returns Its current (possibly edited) text in the language.
   */
  currentValue(path: string): string {
    return this.e.flattenedKeys.find(k => k.path === path)?.value ?? '';
  }

  /**
   * @param path Translation key.
   * @returns Its saved text in the language (before the edits).
   */
  savedValue(path: string): string {
    return this.e.savedValueOf(path);
  }

  /**
   * @param path Translation key.
   * @returns Its Czech text (the reference of every language).
   */
  czValue(path: string): string {
    const value = path.split('.').reduce((node: any, part) => (node == null ? node : node[part]), this.e.czTranslations);
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  /**
   * @description Edits a text: the translation state and the live preview of the page.
   * @param path Translation key.
   * @param value New text.
   */
  edit(path: string, value: string): void {
    if (!this.e.canUpdate) return;
    this.e.updateValue(path, value);
    this.postDrafts();
    this.fitField();
  }

  /**
   * @description Restores the saved text of a changed key (the panel link / ↺ of the list) - at
   *   once on the page too; the other edits stay.
   * @param path Translation key.
   */
  revert(path: string): void {
    this.e.revertValue(path);
    this.postDrafts();
    this.fitField();
  }

  /**
   * @description The field of the selected text grows with its text (a long paragraph is read
   *   whole), up to half of the screen (CSS max-height), then it scrolls.
   */
  fitField(): void {
    setTimeout(() => {
      const field = this.valueField?.nativeElement;
      if (!field) return;
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight + 4}px`;
    });
  }

  /** The list "Upravené texty" shows all of them (else the first CHANGED_LIST_LIMIT). */
  changedExpanded = false;

  /** @returns The changed texts shown in the panel (the last edited first). */
  get changedShown(): { path: string; value: string }[] {
    const all = this.e.changedTexts;
    return this.changedExpanded ? all : all.slice(0, CHANGED_LIST_LIMIT);
  }

  /**
   * @param path Translation key.
   * @returns Whether the page shown has the text (clickable, missing or hidden) - else the list
   *   marks it "jiná stránka" and a click opens it in the panel only.
   */
  onThisPage(path: string): boolean {
    return this.visibleKeys.includes(path) || this.missingKeys.includes(path) || this.hiddenTexts.some(text => text.key === path);
  }

  /**
   * @param section Content section.
   * @returns Name of its part of the admin.
   */
  partLabel(section: TextEditorContentSection): string {
    return this.e.t(`tab_${section}`);
  }

  /**
   * @param where Place of a text that cannot be clicked.
   * @returns Its description (the place itself when unknown).
   */
  whereLabel(where: string): string {
    const label = this.e.t(`editor_where_${where}`);
    return label && !label.includes('editor_where_') ? label : where;
  }

  // ── Frame ───────────────────────────────────────────────────

  /**
   * @description Shows a page of the own website in the current language.
   * @param path Path without the language.
   */
  private navigateFrame(path: string): void {
    const frame = this.frameRef?.nativeElement;
    if (!frame) return;
    this.framePath = safeFramePath(path);
    this.frameLang = this.e.currentLang;
    this.pageTitle = '';
    this.hiddenExpanded = false;
    this.watchTitle();
    this.frameLoading = true;
    frame.src = withLanguagePrefix(this.framePath, this.e.currentLang);
    this.cd.markForCheck();
  }

  /** @returns The edited texts of the language by key (the live preview). */
  private drafts(): Record<string, string> {
    const drafts: Record<string, string> = {};
    for (const path of this.e.changedPaths) {
      drafts[path] = this.currentValue(path);
    }
    return drafts;
  }

  /**
   * @returns Texts missing in the language by key with their Czech reference (shown in their
   *   place on the page, orange); Czech itself has no reference - the page shows the key.
   */
  private missingTexts(): Record<string, string> {
    const missing: Record<string, string> = {};
    for (const key of this.e.flattenedKeys) {
      if (key.missing) {
        missing[key.path] = this.e.currentLang === 'cz' ? '' : this.czValue(key.path);
      }
    }
    return missing;
  }

  /** @description Sends the edits and the missing texts to the page. */
  private postDrafts(): void {
    this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: this.e.currentLang, values: this.drafts(), missing: this.missingTexts() });
  }

  /**
   * @description Sends a message to the page of the frame (own origin only).
   * @param message Message.
   */
  private post(message: TextEditorToFrame): void {
    this.frameRef?.nativeElement.contentWindow?.postMessage(message, window.location.origin);
  }

  /**
   * @description Handles a message of the page (only from the frame of the own origin).
   * @param event Window message.
   */
  private receive(event: MessageEvent): void {
    const frame = this.frameRef?.nativeElement.contentWindow;
    if (!frame || event.source !== frame || event.origin !== window.location.origin || !isTextEditorMessage(event.data)) {
      return;
    }
    const message = event.data as TextEditorFromFrame;
    this.zone.run(() => {
      switch (message.type) {
        case 'ready':
          this.frameLoading = false;
          this.post({
            channel: TEXT_EDITOR_CHANNEL, type: 'init', lang: this.e.currentLang, drafts: this.drafts(),
            missing: this.missingTexts(), selected: this.selectedKey, contentLabels: this.contentLabels(),
            missingLabel: this.e.t('editor_missing_label'),
          });
          break;
        case 'scan':
          this.framePath = safeFramePath(message.path);
          if (message.title !== this.pageTitle) {
            this.pageTitle = message.title;
            this.watchTitle();
          }
          this.visibleKeys = message.visible;
          this.missingKeys = message.missing ?? [];
          this.hiddenTexts = message.hidden;
          break;
        case 'select':
          this.selectedKey = message.key;
          this.contentSection = null;
          this.focusField();
          break;
        case 'content':
          this.contentSection = message.section;
          this.selectedKey = null;
          break;
        case 'key':
          this.shortcut(message.key);
          break;
      }
      this.cd.markForCheck();
    });
  }

  /**
   * @description The placeholder title of a page while it loads is expected; when it stays
   *   PAGE_TITLE_WAIT_MS, the page has no title of its own (the panel says so).
   */
  private watchTitle(): void {
    if (this.titleTimer) clearTimeout(this.titleTimer);
    this.titleTimer = null;
    this.titleMissing = false;
    if (this.titlePending) {
      this.titleTimer = setTimeout(() => {
        this.titleTimer = null;
        this.titleMissing = this.titlePending;
        this.cd.markForCheck();
      }, PAGE_TITLE_WAIT_MS);
    }
  }

  /** @returns Hover labels of the content (in the language of the admin). */
  private contentLabels(): Partial<Record<TextEditorContentSection, string>> {
    const labels: Partial<Record<TextEditorContentSection, string>> = {};
    for (const section of CONTENT_SECTIONS) {
      labels[section] = this.e.t('editor_content_label').replace('{part}', this.partLabel(section));
    }
    return labels;
  }

  /** @description Moves the focus to the field of the selected text once it is shown. */
  private focusField(): void {
    setTimeout(() => this.valueField?.nativeElement.focus({ preventScroll: true }));
    this.fitField();
  }

  /**
   * @description Runs an action at once, or after the confirmation when edits would be lost.
   * @param action The action.
   */
  private guard(action: () => void): void {
    if (this.e.isDirty) {
      this.pendingAction = action;
    } else {
      action();
    }
  }
}

/**
 * @description The remembered preview of the editor.
 * @returns 'mobile' when chosen before, else 'desktop'.
 */
function readDevice(): VisualEditorDevice {
  try {
    return localStorage.getItem(DEVICE_STORAGE_KEY) === 'mobile' ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}
