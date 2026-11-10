/**
 * @file email-template-editor.component.ts
 * @path src/app/admin/components/email-template-editor/email-template-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Modal editor of a confirmation e-mail sent to customers in the language of the
 * page (web_site_settings `<prefix>_*_i18n`): subject, title, greeting, intro, the labels of the
 * summary table and the closing text per language, with a live preview. Shared by the inquiry
 * confirmation (Inquiries, `raw_request_email`) and the order confirmation (Web orders,
 * `sales_order_email`, VT-15) - the pages differ only by the endpoint, the prefix, the i18n
 * section with the texts and the rows of the summary table.
 * @note The preview mirrors the language fallback of the backend (I18nEmailTemplate): text of
 * the language → built-in default (the default texts are the `email_tpl_default_*` keys of the
 * section and must match the backend constants).
 * @usage `<app-email-template-editor endpoint="web/settings/raw-request-email-template"
 *   fieldPrefix="raw_request_email" i18nSection="user-request" [rows]="rows" (closed)="…" />`
 * @dependencies
 * - DataHandler: `languages/web`, GET / PUT of the template endpoint.
 * - AdminLocalizationService: texts of the given section; AlertDialogService: saved message.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';

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
  sample: string;
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
  imports: [FormsModule, UpperCasePipe],
  templateUrl: './email-template-editor.component.html',
  styleUrl: './email-template-editor.component.css',
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

  /**
   * @description Loads the active web languages and the stored texts in parallel - the labels of
   * a language are prepared whichever answer comes first (the inputs bind to nested properties).
   */
  ngOnInit(): void {
    this.dataHandler.get<EmailTemplateLang[]>('languages/web').subscribe({
      next: (res) => {
        this.languages = (Array.isArray(res) ? res : []).filter(l => l.active !== false);
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
        this.template = {
          subject_i18n: stored?.[`${this.fieldPrefix}_subject_i18n`] ?? {},
          title_i18n: stored?.[`${this.fieldPrefix}_title_i18n`] ?? {},
          intro_i18n: stored?.[`${this.fieldPrefix}_intro_i18n`] ?? {},
          outro_i18n: stored?.[`${this.fieldPrefix}_outro_i18n`] ?? {},
          labels_i18n: stored?.[`${this.fieldPrefix}_labels_i18n`] ?? {},
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

  /** @description Makes `labels_i18n[lang]` an object before inputs bind to its properties. */
  private ensureLabels(lang: string): void {
    if (!this.template.labels_i18n[lang]) {
      this.template.labels_i18n[lang] = {};
    }
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
   * @description Preview of a flat field: the text of the shown language, otherwise the default.
   * @param field subject / title / intro / outro.
   */
  preview(field: TextField): string {
    return this.template[`${field}_i18n`][this.currentLang] || this.t(`email_tpl_default_${field}`);
  }

  /**
   * @description Preview of a label (greeting, summary_header, label_*): the text of the shown
   * language, otherwise the default.
   * @param key Label key.
   */
  previewLabel(key: string): string {
    return this.template.labels_i18n[this.currentLang]?.[key] || this.t(`email_tpl_default_${key}`);
  }

  /** @description i18n key of the placeholder of a summary row ('label_email' → email_tpl_placeholder_email). */
  placeholderKey(key: string): string {
    return `email_tpl_placeholder_${key.replace(/^label_/, '')}`;
  }
}
