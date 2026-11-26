/**
 * @file email-template-editor.component.ts
 * @path src/app/admin/components/email-template-editor/email-template-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Modal editor of a confirmation e-mail sent to customers in the language of the
 * page (web_site_settings `<prefix>_*_i18n`): subject, title, greeting, intro, the labels of the
 * summary table and the closing text per language, with a live preview. Shared by the inquiry
 * confirmation (Inquiries, `raw_request_email`), the order confirmation (Web orders,
 * `sales_order_email`, VT-15) and the e-shop order confirmation (E-shop orders, `order_email`,
 * languages of the e-shop) - the pages differ only by the endpoint, the prefix, the i18n section
 * with the texts, the languages and the rows of the summary table.
 * @note The preview mirrors the language fallback of the backend (I18nEmailTemplate): text of
 * the language → Czech text → built-in default (the default texts are the `email_tpl_default_*`
 * keys of the section and must match the backend constants). A field left empty in the shown
 * language is marked orange and every language tab counts its empty fields, so that the
 * fallback is not forgotten (shared texts: admin i18n section `email-template-editor`).
 * @note Layout: the shared popup frame (AdminModalComponent) - the header (title, close) and the
 *   footer (buttons) stay in place, only the body scrolls; Escape / backdrop close it (not while saving).
 * @usage `<app-email-template-editor endpoint="web/settings/raw-request-email-template"
 *   fieldPrefix="raw_request_email" i18nSection="user-request" [rows]="rows" (closed)="…" />`
 * @dependencies
 * - DataHandler: the languages (`languages/web` by default), GET / PUT of the template endpoint.
 * - AdminLocalizationService: texts of the given section; AlertDialogService: saved message.
 * - RowButtonBuilderComponent: the language tabs.
 * - AdminModalComponent: the popup frame.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { RowButtonBuilderComponent } from '../builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems, languageRowButtons } from '../builders/row-button-builder/row-button';
import { AdminModalComponent } from '../admin-modal/admin-modal.component';

/** @description One language of `GET languages/web`. */
export interface EmailTemplateLang {
  code: string;
  name: string;
  active?: boolean;
}

/**
 * @description One row of the summary table: `key` of `<prefix>_labels_i18n` (e.g.
 * 'label_email'; its texts are `email_tpl_<key>` / `email_tpl_placeholder_<key without label_>` /
 * `email_tpl_default_<key>`) and the sample value of the preview.
 */
export interface EmailTemplateRow {
  key: string;
  /** Sample value of the preview; '' = the label is a text of its own (a paragraph under the table). */
  sample: string;
  /** A longer text (e.g. the information on the right of withdrawal): textarea, full width. */
  multiline?: boolean;
  /**
   * false = a text of another e-mail sharing the template (e.g. the payment reminder of an order):
   * edited here, not part of this preview. Default: in the preview.
   */
  preview?: boolean;
  /** i18n key (of the section) of a heading shown before the row - starts a group of the form. */
  section?: string;
}

/** @description i18n texts of the template being edited. */
interface EmailTemplateState {
  subject_i18n: Record<string, string>;
  title_i18n: Record<string, string>;
  intro_i18n: Record<string, string>;
  outro_i18n: Record<string, string>;
  labels_i18n: Record<string, Record<string, string>>;
}

/** @description Flat (non-label) fields of the template. */
type TextField = 'subject' | 'title' | 'intro' | 'outro';

@Component({
  selector: 'app-email-template-editor',
  standalone: true,
  imports: [FormsModule, RowButtonBuilderComponent, AdminModalComponent],
  templateUrl: './email-template-editor.component.html',
  styleUrls: ['../../shared-styles/modal.css', './email-template-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmailTemplateEditorComponent implements OnInit {
  /** GET / PUT endpoint of the template, e.g. 'web/settings/raw-request-email-template'. */
  @Input({ required: true }) endpoint!: string;
  /** Prefix of the fields, e.g. 'raw_request_email' → raw_request_email_subject_i18n … */
  @Input({ required: true }) fieldPrefix!: string;
  /** Admin i18n section with the `email_tpl_*` texts of this template. */
  @Input({ required: true }) i18nSection!: string;
  /** Rows of the summary table (order = order in the e-mail). */
  @Input({ required: true }) rows: EmailTemplateRow[] = [];
  /** Text after the subject in the preview (the inquiry adds ' – <topic>'). */
  @Input() subjectSuffix = '';
  /** Languages offered (`languages/web` - the web; `languages/shop` - the e-shop). */
  @Input() languagesEndpoint = 'languages/web';
  /** The modal was closed (saved or cancelled). */
  @Output() closed = new EventEmitter<void>();

  private dataHandler = inject(DataHandler);
  private i18n = inject(AdminLocalizationService);
  private alert = inject(AlertDialogService);
  private cd = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  languages: EmailTemplateLang[] = [];
  currentLang = 'cz';
  template: EmailTemplateState = { subject_i18n: {}, title_i18n: {}, intro_i18n: {}, outro_i18n: {}, labels_i18n: {} };

  /** @description Text of the section of this template. */
  t(key: string): string {
    return this.i18n.getValue(`${this.i18nSection}.${key}`);
  }

  /** @description Shared text of the editor (admin i18n section `email-template-editor`). */
  shared(key: string): string {
    return this.i18n.getValue(`email-template-editor.${key}`);
  }

  /**
   * @description Whether a text is filled in (not only spaces).
   * @param value Text of a field.
   */
  isFilled(value: string | null | undefined): boolean {
    return !!value && value.trim() !== '';
  }

  /**
   * @description Number of the fields of a language that are empty (they would fall back to the
   *   Czech text or the default wording): the four texts, the greeting, the summary heading and
   *   every row of the summary.
   * @param lang Language code.
   */
  missingCount(lang: string): number {
    const texts: Array<string | undefined> = [
      this.template.subject_i18n[lang], this.template.title_i18n[lang],
      this.template.intro_i18n[lang], this.template.outro_i18n[lang],
    ];
    const labels = this.template.labels_i18n[lang] ?? {};
    for (const key of ['greeting', 'summary_header', ...this.rows.map(r => r.key)]) {
      texts.push(labels[key]);
    }
    return texts.filter(text => !this.isFilled(text)).length;
  }

  /**
   * @description Loads the active languages and the stored texts in parallel - the labels of
   * a language are prepared whichever answer comes first (the inputs bind to nested properties).
   */
  ngOnInit(): void {
    this.dataHandler.get<EmailTemplateLang[]>(this.languagesEndpoint).subscribe({
      next: (res) => {
        // the switched off languages too: the e-mail is prepared before the language is switched on
        this.languages = Array.isArray(res) ? res : [];
        if (this.languages.length > 0 && !this.languages.find(l => l.code === this.currentLang)) {
          this.currentLang = this.languages[0].code;
        }
        this.languages.forEach(l => this.ensureLabels(l.code));
        this.ensureLabels(this.currentLang);
        this.cd.markForCheck();
      },
      error: () => {
        // Without the list at least Czech works (the language name itself is not translated).
        this.languages = [{ code: 'cz', name: 'Čeština' }];
        this.ensureLabels('cz');
        this.cd.markForCheck();
      }
    });

    this.dataHandler.get<any>(this.endpoint).subscribe({
      next: (stored) => {
        const labels = EmailTemplateEditorComponent.textMap(stored?.[`${this.fieldPrefix}_labels_i18n`]);
        this.template = {
          subject_i18n: EmailTemplateEditorComponent.textMap(stored?.[`${this.fieldPrefix}_subject_i18n`]),
          title_i18n: EmailTemplateEditorComponent.textMap(stored?.[`${this.fieldPrefix}_title_i18n`]),
          intro_i18n: EmailTemplateEditorComponent.textMap(stored?.[`${this.fieldPrefix}_intro_i18n`]),
          outro_i18n: EmailTemplateEditorComponent.textMap(stored?.[`${this.fieldPrefix}_outro_i18n`]),
          labels_i18n: Object.fromEntries(
            Object.entries(labels).map(([lang, texts]) => [lang, EmailTemplateEditorComponent.textMap(texts)])
          ),
        };
        this.ensureLabels(this.currentLang);
        this.loading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description A stored text map as a plain object. The API returns a language saved without
   *   any text as an empty JSON array (`[]` - an empty PHP array), and texts typed into a JS
   *   array are dropped by JSON.stringify: the save would report success and store nothing.
   * @param value Stored value (object, `[]`, null …).
   * @returns A new plain object (texts by key), `{}` for anything else.
   */
  private static textMap(value: unknown): Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
  }

  /** @description Makes `labels_i18n[lang]` a plain object before inputs bind to its properties. */
  private ensureLabels(lang: string): void {
    const labels = this.template.labels_i18n[lang];
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
      this.template.labels_i18n[lang] = {};
    }
  }

  /** Stable buttons of the language tabs. */
  private readonly langButtons = new RowButtonItems();

  /** @description Language tabs (upper-case code) with the number of empty fields. */
  get langItems(): RowButton[] {
    return this.langButtons.update(languageRowButtons(this.languages, {
      inactiveTitle: this.i18n.getValue('shared.inactive_language_title'),
      count: code => this.missingCount(code),
      title: code => this.missingCount(code) ? this.shared('missing_tab_title') : '',
    }));
  }

  /** @description Switches the language tab - only the shown language changes. */
  switchLang(code: string): void {
    this.ensureLabels(code);
    this.currentLang = code;
    this.cd.markForCheck();
  }

  /** @description Closes the modal (not while saving). */
  close(): void {
    if (this.saving) return;
    this.closed.emit();
  }

  /**
   * @description Saves all languages of the template and closes the modal - no
   * `confirm_password`, only the permission of the route (editing a text is not sensitive).
   */
  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.cd.markForCheck();

    const p = this.fieldPrefix;
    const payload = {
      [`${p}_subject_i18n`]: this.template.subject_i18n,
      [`${p}_title_i18n`]: this.template.title_i18n,
      [`${p}_intro_i18n`]: this.template.intro_i18n,
      [`${p}_outro_i18n`]: this.template.outro_i18n,
      [`${p}_labels_i18n`]: this.template.labels_i18n,
    };

    this.dataHandler.put<any>(this.endpoint, payload).subscribe({
      next: () => {
        this.saving = false;
        this.alert.open(this.t('email_tpl_saved_title'), this.t('email_tpl_saved_message'), 'success');
        this.closed.emit();
      },
      error: () => {
        this.saving = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Preview of a flat field: the text of the shown language, otherwise the Czech
   * text, otherwise the default (as the backend sends it).
   * @param field subject / title / intro / outro.
   */
  preview(field: TextField): string {
    const texts = this.template[`${field}_i18n`];
    return texts[this.currentLang]?.trim() || texts['cz']?.trim() || this.t(`email_tpl_default_${field}`);
  }

  /**
   * @description Preview of a label (greeting, summary_header, label_*): the text of the shown
   * language, otherwise the Czech text, otherwise the default (as the backend sends it).
   * @param key Label key.
   */
  previewLabel(key: string): string {
    return this.template.labels_i18n[this.currentLang]?.[key]?.trim()
      || this.template.labels_i18n['cz']?.[key]?.trim()
      || this.t(`email_tpl_default_${key}`);
  }

  /**
   * @description Placeholder of a flat field: what an empty field sends - the Czech text in
   * another language, otherwise the default wording.
   * @param field subject / title / intro / outro.
   */
  textPlaceholder(field: TextField): string {
    const cz = this.currentLang !== 'cz' ? this.template[`${field}_i18n`]['cz']?.trim() : '';
    return cz || this.t(`email_tpl_placeholder_${field}`);
  }

  /**
   * @description Placeholder of a label (greeting, summary_header, label_* …): the Czech text in
   * another language, otherwise the default wording.
   * @param key Label key.
   */
  labelPlaceholder(key: string): string {
    const cz = this.currentLang !== 'cz' ? this.template.labels_i18n['cz']?.[key]?.trim() : '';
    return cz || this.t(this.placeholderKey(key));
  }

  /** @description i18n key of the placeholder of a summary row ('label_email' → email_tpl_placeholder_email). */
  placeholderKey(key: string): string {
    return `email_tpl_placeholder_${key.replace(/^label_/, '')}`;
  }
}
