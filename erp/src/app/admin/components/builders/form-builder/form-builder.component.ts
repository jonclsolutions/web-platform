/**
 * @file form-builder.component.ts
 * @path src/app/admin/components/builders/form-builder/form-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic, template-driven form generator that maps field definitions to interactive UI controls.
 *
 * @refactor-note (2026-08) Přepsáno matchování hesel u `confirm-password` typu z
 * imperativního `checkPasswordMatch()` (mutovalo sdílenou `passwordsNotMatching`
 * proměnnou přes `(ngModelChange)` handlery vedle `[(ngModel)]` na TÉŽE inputu - závislé
 * na pořadí, v jakém Angular sloučené listenery na stejný event spouští, křehké a
 * nespolehlivé) na čistou `passwordMismatch(columnName)` metodu, počítanou LIVE při každém
 * change-detection cyklu přímo z `formData`/`confirmPasswordData`, bez uloženého stavu.
 * Díky tomu nemůže dojít k desynchronizaci mezi tím, co je vidět na obrazovce a tím, co
 * `onSubmit()` skutečně vyhodnotí. `[pattern]` navíc nově skutečně aplikováno i na první
 * input `confirm-password` case (dřív tam chybělo úplně, takže `pattern`/`errorMessage`
 * z konfigurace se na hesla nikdy nepoužily). Přidán live checklist požadavků hesla
 * (`PasswordRequirementsChecklistComponent`) pod prvním password inputem.
 *
 * @refactor-note (2026-08-2) Přidán typ `'files'` (množné číslo, na rozdíl od `'file'`,
 * které zůstává jako jednosouborové pole) - napojuje sdílenou `MultiFileUploadComponent`
 * (max. 10 souborů / 20 MB / 50 MB, stejná politika jako veřejné formuláře). V edit módu
 * se pole VŽDY inicializuje jako prázdné pole (`resetFileArrayFields()`), i kdyby
 * `formDataToEdit` neslo existující `attachments` (pole objektů z API, ne `File`
 * instance) - `'files'` pole slouží jen k PŘIDÁNÍ nových příloh, správa/mazání
 * existujících je mimo scope (viz TableBuilder detail zobrazení). `onSubmit()` upraven,
 * aby detekoval jak jednotlivý `File` (typ `'file'`), tak pole `File[]` (typ `'files'`) a
 * do `FormData` je serializoval odpovídajícím způsobem (`key` vs. `key[]`).
 *
 * @bugfix-note (2026-08-19) KRITICKÝ BUG - EDIT SE SOUBOREM VYTVOŘIL NOVÝ ZÁZNAM MÍSTO
 * AKTUALIZACE: `FormData` instance nepodporuje čtení hodnot přes tečkovou notaci
 * (`payload.id`), jen `.get('id')`. Konzumentské komponenty napříč adminem (např.
 * `UserRequestComponent.handleFormSubmitted()`) ale rozhodují mezi update/create přes
 * `formData.id ? update() : create()` - na `FormData` instanci to VŽDY vyhodnotí
 * `undefined`, tedy `create()`, i při editaci existujícího záznamu s přiloženým
 * souborem. Bez souboru je `payload` plain objekt, kde `.id` funguje normálně - proto
 * se bug projevoval JEN v kombinaci "edit" + "alespoň jeden soubor". Oprava v
 * `onSubmit()`: `id` se navíc nastaví jako obyčejná vlastnost JS objektu přímo na
 * `FormData` instanci (nijak neovlivní multipart serializaci - Angular `HttpClient`
 * posílá `FormData` podle jejích interních `entries`, ne podle vlastností objektu).
 * Oprava je na jednom místě (zde), takže platí automaticky pro VŠECHNY stránky s
 * file/files poli, ne jen pro user-request.
 *
 * @refactor-note (2026-08-19v2) BACKLOG "mazání existujících příloh v editu - staged":
 * `onExistingFilesRemoved()` ukládá ID příloh označených ke smazání pod
 * `${columnName}_removed_ids` do `formData` - viz MultiFileUploadComponent. Zároveň
 * opraven latentní bug v `onSubmit()`: multipart (`FormData`) větev dřív TICHO
 * ZAHAZOVALA jakékoliv nesouborové pole typu pole (array), takže `..._removed_ids` by
 * se při současném přidání nového souboru nikdy nedostalo na server - teď se neprázdná
 * pole serializují jako `key[]`, stejně jako pole souborů.
 *
 * @bugfix-note (2026-08-24) KRITICKÝ BUG - VÍCENÁSOBNÉ ODESLÁNÍ PŘI RYCHLÉM OPAKOVANÉM
 * KLIKNUTÍ NA "POTVRDIT": `this.isSubmitting = false;` se dřív volalo ihned po
 * `formSubmitted.emit(payload)`, ve STEJNÉM synchronním běhu `onSubmit()`. Jenže emit
 * je jen vyhození události, NE čekání na dokončení skutečného HTTP requestu (ten běží
 * až v rodičovské komponentě přes `postData()/updateData().subscribe()`). Guard
 * `if (this.isSubmitting) return;` na začátku metody byl tak fakticky bezvýznamný -
 * `isSubmitting` bylo `true` a hned zase `false` dřív, než uživatel stihl kliknout
 * podruhé, takže každý další klik prošel guardem znovu a emitoval další
 * `formSubmitted` -> další HTTP POST -> duplicitní záznamy (3 kliky = 3 záznamy).
 * ŘEŠENÍ: `isSubmitting` se nastaví na `true` a UŽ SE NIKDY neresetuje zpátky odsud -
 * tlačítko zůstane `disabled` (viz `.html` binding), dokud rodičovská stránka po
 * dokončení requestu (úspěch i chyba - konzistentně napříč projektem přes
 * `finalize(() => showCreateForm = false)`) modal nezavře, čímž se tahle komponenta
 * kompletně zničí (`@if` v rodičovské šabloně). Uživatel může formulář kdykoliv zavřít
 * tlačítkem "Zrušit" (`onCancel()` na `isSubmitting` nezávisí), takže ani výpadek sítě
 * nevede do slepé uličky.
 *
 * @bugfix-note (2026-08-25) KRITICKÝ BUG - SOUČASNÉ ZOBRAZENÍ ZELENÉHO "ÚSPĚCH" I
 * ČERVENÉHO CHYBOVÉHO TOASTU: `onSubmit()` volal `this.alertDialogService.open('Information',
 * ...)` HNED po `emit()`, tedy ještě PŘED skutečným HTTP requestem (ten běží až
 * v konzumentské stránce). Pokud backend request zamítl (např. 422 - nepovolená
 * e-mailová doména, vynucená 2FA, atd.), uživatel viděl NEJDŘÍV zelený "úspěch" a
 * hned poté červenou chybu - matoucí a věcně nesprávné. ŘEŠENÍ: `FormBuilderComponent`
 * už NEUKAZUJE žádný toast o výsledku uložení vůbec - jen emituje `payload`.
 * Vyhodnocení úspěch/neúspěch (zelený/červený toast) je VÝHRADNĚ na konzumentské
 * stránce v `subscribe({next, error})`, protože jen tam je v okamžiku volání known
 * skutečný výsledek z API. Toast se tak nikdy nemůže objevit "špatně" ani zdvojeně,
 * protože existuje přesně JEDNO místo (odpověď HTTP requestu), které o něm rozhoduje.
 *
 * @refactor-note (2026-08-31) SCROLL LOCK SJEDNOCEN - dřív přímé
 * `document.body.style.overflow = 'hidden'/'auto'` v ngOnInit/ngOnDestroy, teď
 * deleguje na sdílený `ScrollLockService` (viz scroll-lock.service.ts).
 *
 * @dependencies
 * - FormsModule: Angular template-driven form infrastructure.
 * - AlertDialogService: Provides user feedback for submission outcomes.
 * - InputDefinition: Interface for rendering dynamic form inputs and validation metadata.
 * - PasswordRequirementsChecklistComponent: Live vizuální checklist pravidel hesla.
 * - MultiFileUploadComponent: Sdílený drag&drop multi-file upload, viz `'files'` case.
 * - ScrollLockService: Sdílený zámek scrollu na pozadí.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule, NgForm, FormControl } from '@angular/forms';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { PasswordRequirementsChecklistComponent } from '../../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';

/**
 * @description Renders a dynamic form based on an array of field definitions.
 * @usage Used in create and edit modals across the admin panel for data entry.
 * @note Supports file uploads via FormData auto-detection, password matching validation, and persistent scroll locking.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [FormsModule, PasswordRequirementsChecklistComponent, MultiFileUploadComponent],
  templateUrl: './form-builder.component.html',
  styleUrl: './form-builder.component.css',
})
export class FormBuilderComponent implements OnInit, OnDestroy {
  @Input() headerText: string = 'Create New Record';
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() formDataToEdit: any = null;

  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCanceled = new EventEmitter<void>();

  @ViewChild('genericForm') genericForm!: NgForm;

  formData: { [key: string]: any } = {};
  confirmPasswordData: { [key: string]: string } = {};
  isSubmitting = false;
  visibleInputDefinitions: InputDefinition[] = [];

  private scrollLock = inject(ScrollLockService);

  constructor(
    private cd: ChangeDetectorRef,
    private alertDialogService: AlertDialogService
  ) {}

  /**
   * @description Initializes the form state based on the provided data or default settings.
   */
  ngOnInit(): void {
    this.scrollLock.lock();

    if (this.formDataToEdit) {
      this.formData = { ...this.formDataToEdit };
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_edit !== false);
      this.normalizeSelectValues();
      this.resetFileArrayFields();
    } else {
      this.formData = {};
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_create !== false);
      this.visibleInputDefinitions.forEach(input => {
        this.formData[input.column_name] = input.type === 'files' ? [] : (input.defaultValue ?? '');
      });
    }
  }

  /**
   * @description Normalizes existing data for select inputs to ensure consistent type matching.
   * @note Prevents type mismatch issues when mapping numeric IDs to string-based option values.
   */
  private normalizeSelectValues(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'select' && input.options) {
        const currentValue = this.formData[input.column_name];
        const valueAsString = String(currentValue === true ? '1' : currentValue === false ? '0' : currentValue);
        const optionExists = input.options.some(opt => String(opt.value) === valueAsString);

        if (optionExists) {
          this.formData[input.column_name] = valueAsString;
        }
      }
    });
  }

  /**
   * @description Vynutí prázdné pole pro každé `'files'` pole PŘI EDITACI - `formDataToEdit`
   * u takového klíče typicky nese existující přílohy jako pole API objektů (`{id, url,
   * original_filename, ...}`), ne `File` instance. Bez tohoto resetu by `onSubmit()`
   * takové pole nerozpoznal jako soubory (neprojde `isFileArray()` testem) a skončilo by
   * jako nesmyslně stringifikované do `FormData`. `'files'` pole slouží výhradně k
   * PŘIDÁNÍ nových příloh - správa/mazání starých je mimo scope tohoto formuláře.
   */
  private resetFileArrayFields(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'files') {
        this.formData[input.column_name] = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollLock.unlock();
  }

  /**
   * @description Zjišťuje, jestli se u daného `confirm-password` pole aktuálně neshoduje
   * hlavní hodnota (`formData[columnName]`) s potvrzením (`confirmPasswordData[columnName]`).
   * Počítá se live při každém CD cyklu - žádný uložený stav, žádná závislost na pořadí
   * event handlerů. Prázdné potvrzení (uživatel ho ještě nezačal psát) se nepovažuje
   * za neshodu - chyba se ukáže, až uživatel do potvrzení něco napíše.
   */
  passwordMismatch(columnName: string): boolean {
    const confirmation = this.confirmPasswordData[columnName];
    if (!confirmation) return false;
    return this.formData[columnName] !== confirmation;
  }

  /**
   * @description Jestli existuje JAKÉKOLIV `confirm-password` pole ve formuláři s
   * neshodujícím se potvrzením - použito v `onSubmit()` k zablokování odeslání a na
   * submit tlačítku k jeho disable.
   */
  get hasPasswordMismatch(): boolean {
    return this.visibleInputDefinitions.some(
      input => input.type === 'confirm-password' && this.passwordMismatch(input.column_name)
    );
  }

  /**
   * @description Updates form data with file inputs for multi-part submission.
   */
  onFileChange(event: any, columnName: string): void {
    const file = event.target.files[0];
    if (file) {
      this.formData[columnName] = file;
    }
  }

  /**
   * @description Přijímá aktuální seznam souborů z `MultiFileUploadComponent` pro pole
   * typu `'files'`. Komponenta sama hlídá klientský limit (10 souborů / 20 MB / 50 MB
   * celkem) jako UX pomůcku - skutečnou hranici vždy vynucuje backend.
   */
  onFilesChange(files: File[], columnName: string): void {
    this.formData[columnName] = files;
  }

  /**
   * @description Přijímá aktuální seznam ID existujících příloh označených ke smazání
   * (STAGED - žádné API volání zatím neproběhlo, viz MultiFileUploadComponent). Uloží
   * je pod `${columnName}_removed_ids` do `formData`, odkud je `onSubmit()` pošle na
   * server AŽ při reálném uložení celého formuláře. Storno formuláře tenhle stav nikam
   * neodešle - `formData` se prostě zahodí spolu s celou komponentou.
   * @bugfix-note (2026-08-19v2) BACKLOG "mazání existujících příloh v editu - staged".
   */
  onExistingFilesRemoved(removedIds: number[], columnName: string): void {
    this.formData[`${columnName}_removed_ids`] = removedIds;
  }

  private isFileArray(value: any): value is File[] {
    return Array.isArray(value) && value.length > 0 && value.every(v => v instanceof File);
  }

  getControl(columnName: string): FormControl | null {
    if (!this.genericForm) return null;
    return this.genericForm.controls[columnName] as FormControl || null;
  }

  /**
   * @description Maps validation errors to human-readable strings based on field definition.
   */
  getValidationErrorMessage(control: FormControl | null, fieldDefinition: InputDefinition): string | null {
    if (!control || !control.invalid || (!control.dirty && !control.touched)) {
      return null;
    }
    if (control.errors?.['required']) return fieldDefinition.errorMessage || 'This field is required.';
    if (control.errors?.['pattern']) return fieldDefinition.errorMessage || 'Invalid format.';
    if (control.errors?.['email']) return fieldDefinition.errorMessage || 'Invalid email format.';
    return null;
  }

  onCancel(): void {
    this.formCanceled.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  /**
   * @description Sanitizes and validates form data before emitting the submission event.
   * @note Automatically serializes data into FormData if file inputs (single `File` or
   * `File[]` from a `'files'` field) are detected. Single files se posílají pod svým
   * klíčem beze změny (`key`), pole souborů pod `key[]` (Laravel/PHP konvence pro
   * vícenásobný upload, sedí s `attachments[]` očekávaným backendem).
   * @bugfix-note (2026-08-24) `isSubmitting` se po úspěšném emitu záměrně JIŽ
   * NERESETUJE zpátky na `false` - viz refactor-note v hlavičce souboru (fix
   * vícenásobného odeslání při rychlém opakovaném kliknutí).
   */
  onSubmit(form: NgForm, event?: Event): void {
    event?.preventDefault();
    if (this.isSubmitting) return;

    Object.keys(form.controls).forEach(field => {
      form.controls[field]?.markAsTouched();
    });

    if (this.hasPasswordMismatch) {
      this.alertDialogService.open('Error', 'Passwords do not match.', 'danger');
      return;
    }

    if (form.valid) {
      this.isSubmitting = true;

      let payload: any;
      const hasFile = Object.values(this.formData).some(val => val instanceof File || this.isFileArray(val));

      if (hasFile) {
        payload = new FormData();
        Object.keys(this.formData).forEach(key => {
          const value = this.formData[key];
          if (value instanceof File) {
            payload.append(key, value, value.name);
          } else if (this.isFileArray(value)) {
            value.forEach((file: File) => payload.append(`${key}[]`, file, file.name));
          } else if (Array.isArray(value)) {
            /**
             * @bugfix-note (2026-08-19v2) DŘÍV se JAKÉKOLIV nesouborové pole (array)
             * v multipart větvi TICHO ZAHAZOVALO ("nemá smysl posílat" - platilo jen
             * pro prázdné 'files' pole bez výběru, ale zasáhlo úplně všechny array
             * hodnoty). To by mimo jiné znamenalo, že nově zavedené
             * `attachments_removed_ids` (viz onExistingFilesRemoved()) by se při
             * SOUČASNÉM přidání nového souboru na server nikdy nedostalo - staged
             * smazání staré přílohy by se ztratilo, kdykoliv admin zároveň nahrával i
             * něco nového. Oprava: prázdné pole se pořád přeskočí (nic k poslání), ale
             * neprázdné se serializuje jako `key[]`, stejná PHP/Laravel konvence jako
             * u pole souborů o pár řádků výš.
             */
            if (value.length === 0) return;
            value.forEach((item: any) => payload.append(`${key}[]`, String(item)));
          } else if (value !== null && value !== undefined) {
            payload.append(key, String(value));
          }
        });

        /**
         * @bugfix-note (2026-08-19) `FormData` instance NEPODPORUJE čtení hodnot přes
         * tečkovou notaci (`payload.id`) - jen přes `.get('id')`. `id` je sice výše
         * správně přidané do multipart dat (`payload.append('id', ...)`), ale
         * konzumentské komponenty napříč adminem (např.
         * `UserRequestComponent.handleFormSubmitted()`) rozhodují mezi update/create
         * přes `formData.id ? update() : create()` - na `FormData` instanci to bez
         * tohoto řádku VŽDY vyhodnotí `undefined`, tedy vždy `create()`, i při editaci
         * existujícího záznamu. Řešení: nastavit `id` NAVÍC jako obyčejnou vlastnost JS
         * objektu přímo na `FormData` instanci - nijak to neovlivní multipart
         * serializaci (Angular `HttpClient` posílá `FormData` podle jejích interních
         * `entries`, ne podle vlastností objektu), ale `formData.id` v konzumentských
         * komponentách bude fungovat stejně spolehlivě jako u běžného JSON payloadu.
         * Oprava na jednom místě - platí automaticky pro všechny stránky s file/files
         * poli, ne jen pro tu, kde byl bug nahlášen.
         */
        if (this.formData['id'] !== undefined && this.formData['id'] !== null) {
          (payload as any).id = this.formData['id'];
        }
      } else {
        payload = { ...this.formData };
      }

      this.formSubmitted.emit(payload);

      /**
       * @bugfix-note (2026-08-25) KRITICKÝ BUG - ZELENÝ "ÚSPĚCH" TOAST SE ZOBRAZOVAL
       * VŽDY, I KDYŽ BACKEND POŽADAVEK NAKONEC ZAMÍTL: dřív se tady volalo
       * `this.alertDialogService.open('Information', ...)` HNED po `emit()`, tedy
       * ještě PŘED tím, než vůbec proběhl skutečný HTTP request (ten běží až
       * v konzumentské stránce přes `postData()/updateData().subscribe()`). Uživatel
       * tak viděl zelený "úspěch", a hned vzápětí (po doběhnutí requestu) i červenou
       * chybu z reálného 422/500 - obě najednou, což nedává smysl a matoucí to je.
       *
       * ŘEŠENÍ: `FormBuilderComponent` už NEUKAZUJE ŽÁDNÝ toast o výsledku uložení -
       * jen emituje `payload` a je na KONZUMENTSKÉ STRÁNCE (přes `subscribe({next,
       * error})`), aby zobrazila zelený toast při úspěchu (`next`) a červený při chybě
       * (`error`) - teprve TEHDY je totiž známý skutečný výsledek z API. Toast se tak
       * nikdy nemůže objevit "špatně" ani zdvojeně, protože existuje přesně JEDNO
       * místo (odpověď HTTP requestu), které o něm rozhoduje.
       */

      // `isSubmitting` ZÁMĚRNĚ zůstává `true` - viz bugfix-note (2026-08-24) výše.
      // Tlačítko "Potvrdit" tak zůstane disabled, dokud rodičovská stránka po
      // dokončení HTTP requestu modal nezavře (tahle komponenta se tím zničí úplně).
    } else {
      this.alertDialogService.open('Invalid Form', 'Please check all required fields.', 'warning');
    }
  }
}