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
 *   points to its part. The translation state, saving and discarding are those of the
 *   translation editor of the module (`e`, BaseTranslationEditorComponent).
 * @usage `<app-visual-text-editor-view [e]="this" [pages]="pages" backRoute="/admin/web/edit-website" />`
 *   in a page component that extends BaseTranslationEditorComponent.
 * @dependencies BaseTranslationEditorComponent, AdminModalComponent, text-editor-protocol,
 *   language-url, table-cards (phone limit)
 * @note Not on a phone (≤ 640 px): a notice with the way back instead of the editor.
 * @note Security: the frame shows the own website (same origin, path checked) in a sandbox
 *   without forms, pop-ups and navigation of the admin; messages are accepted only from the
 *   window of the frame and the own origin.
 */

import {
  AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, Input, NgZone, OnDestroy,
  OnInit, ViewChild, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BaseTranslationEditorComponent, LangMeta } from '../base-translation-editor.component';
import { AdminModalComponent } from '../../admin-modal/admin-modal.component';
import { phoneQuery } from '../../builders/table-cards';
import { withLanguagePrefix } from '../../../../shared/utils/language-url';
import {
  TEXT_EDITOR_CHANNEL, TEXT_EDITOR_FRAME_NAME, TextEditorContentSection, TextEditorFromFrame,
  TextEditorHiddenText, TextEditorToFrame, isTextEditorMessage,
} from '../../../../public/text-editor/text-editor-protocol';

/** A page of the website offered in the editor. */
export interface VisualEditorPage {
  /** Path without the language (`/`, `/faq`). */
  path: string;
  /** Key of its name (`e.t()`). */
  labelKey: string;
}

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
  imports: [FormsModule, AdminModalComponent],
  templateUrl: './visual-text-editor-view.component.html',
  styleUrls: ['../../../shared-styles/theme.css', '../../../../shared/styles/base.css', '../../../shared-styles/modal.css', './visual-text-editor-view.component.css'],
})
export class VisualTextEditorViewComponent implements OnInit, AfterViewInit, OnDestroy {
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
  /** Selected text (key), null = none. */
  selectedKey: string | null = null;
  /** Clicked content of the admin, null = none. */
  contentSection: TextEditorContentSection | null = null;
  /** Action waiting for the confirmation to throw away the unsaved edits. */
  pendingAction: (() => void) | null = null;

  /** Saved values of the edited texts (before their first edit since the last save / load). */
  private readonly originals = new Map<string, string>();
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
    this.e.saved$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.originals.clear();
      this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'commit' });
    });
  }

  /** @description Opens the first page of the list in the frame. */
  ngAfterViewInit(): void {
    if (!this.isPhone) {
      this.navigateFrame(this.pages[0]?.path ?? '/');
    }
  }

  /** @description Stops listening. */
  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
    this.phone?.removeEventListener('change', this.onPhoneChange);
  }

  /**
   * @description The browser asks before closing / reloading the tab with unsaved edits.
   * @param event beforeunload.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.e.isDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ── Page, language, leaving ─────────────────────────────────

  /** @returns Active languages (the website shows only them). */
  get activeLanguages(): LangMeta[] {
    return this.e.languages.filter(lang => lang.active);
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
      this.originals.clear();
      this.e.loadLang(code);
      this.navigateFrame(this.framePath);
    });
  }

  /** @description Back to the list of the texts (after a confirmation with unsaved edits). */
  close(): void {
    this.guard(() => this.router.navigateByUrl(this.backRoute));
  }

  /**
   * @description Opens a part of the admin (content tab, page titles) - after a confirmation with
   *   unsaved edits.
   * @param tab Key of the tab of the text editor page.
   */
  openTab(tab: string): void {
    this.guard(() => this.router.navigate([this.backRoute], { queryParams: { tab } }));
  }

  /** @description Saves the texts of the language (the page keeps them, see `saved$`). */
  save(): void {
    this.e.onSubmit();
  }

  /** @description Throws the edits away after a confirmation. */
  askDiscard(): void {
    this.pendingAction = () => {
      this.originals.clear();
      this.e.discardChanges();
      this.postDrafts();
    };
  }

  /** @description Runs the confirmed action (the edits are lost). */
  confirmPending(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    action?.();
  }

  /** @description Keeps the edits, nothing happens. */
  cancelPending(): void {
    this.pendingAction = null;
  }

  /** @returns Text of the confirmation: how many edits of which language are lost. */
  get pendingMessage(): string {
    return this.e.t('discard_confirm_message')
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
    if (!this.e.isDirty) {
      this.originals.clear();
    }
    return this.originals.has(path) ? this.originals.get(path)! : this.currentValue(path);
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
    if (!this.originals.has(path)) {
      this.originals.set(path, this.currentValue(path));
    }
    this.e.updateValue(path, value);
    this.postDrafts();
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

  /** @description Sends the edits to the page. */
  private postDrafts(): void {
    this.post({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: this.e.currentLang, values: this.drafts() });
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
            selected: this.selectedKey, contentLabels: this.contentLabels(),
          });
          break;
        case 'scan':
          this.framePath = safeFramePath(message.path);
          this.pageTitle = message.title;
          this.visibleKeys = message.visible;
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
      }
      this.cd.markForCheck();
    });
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
