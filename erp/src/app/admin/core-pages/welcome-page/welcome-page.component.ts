/**
 * @file welcome-page.component.ts
 * @path src/app/admin/web-pages/welcome-page/welcome-page.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Uvítací stránka po přihlášení - vidí ji každý uživatel s oprávněním
 *              `web-view-welcome-page` (viz routes). Obsahuje jen nesenzitivní údaje
 *              (jméno, e-mail, role, datum vytvoření účtu) a rychlý odkaz na nahlášení
 *              chyby. Citlivé přehledy (počty uživatelů, tickety, systémové logy) zůstávají
 *              výhradně na Dashboardu, chráněném samostatným `web-view-dashboard` oprávněním.
 * @dependencies
 * - AuthService: Poskytuje roli/e-mail aktuálně přihlášeného uživatele ze session.
 * - CurrentUserProfileService: TTL-cached čtení vlastního profilu, sdílené s
 *   PersonalInfoComponent - viz refactor-note (2026-08-8) níže.
 * - AdminLocalizationService: Statické i18n admin UI - viz refactor-note (2026-09) níže.
 * @note `dataHandler.get()` se používal záměrně místo `dataHandler.getOne()`, protože
 *       endpoint `core/users/{id}` vrací zdroj NEobalený v `{ data: ... }` (viz
 *       UserController::show()) - stejné chování teď zapouzdřuje `CurrentUserProfileService`.
 * @refactor-note (2026-08-8) Zdroj profilu přepnut z přímého `dataHandler.get('core/users/
 * {id}')` na sdílenou `CurrentUserProfileService` (backlog: "zbytečně moc dotazů na API") -
 * tahle stránka je typický post-login landing point, takže uživatel co odsud pokračuje na
 * "Osobní Informace" (PersonalInfoComponent) dřív vždy vyvolal DRUHÝ nezávislý požadavek
 * na tentýž `core/users/{id}` záznam. Sdílená TTL cache (2 min) tomu předchází. `DataHandler`
 * injekce už tu není potřeba, komponenta ji nikde jinde nepoužívala.
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * Komponenta NEdědí BaseDataComponent (samostatná landing page, ne datová stránka
 * s CRUD), proto ruční injection `AdminLocalizationService` dle vzoru
 * `PersonalInfoComponent`/`AdminLayoutComponent`. Nahrazeny VŠECHNY uživatelsky
 * viditelné texty (subtitle, profil labely, chybová hláška, welcome zpráva, footer,
 * "Nahlásit chybu" karta). BUG OPRAVEN SOUČASNĚ: `currentDateTime`/`formatDate()`
 * měly natvrdo `'cs-CZ'` v `toLocaleDateString()`/`toLocaleString()` - datum bylo VŽDY
 * česky bez ohledu na zvolený admin jazyk. Nahrazeno `this.i18n.getDateLocale()`
 * (stejný helper jako u AdminLayoutComponent, viz admin-localization.service.ts
 * refactor-note 2026-09). `helpSection` (NavSection) je teď getter, ne `readonly`
 * pole, protože i18n hodnoty musí být čerstvé při každém přístupu, ne zafixované
 * jednou v okamžiku definice třídy - viz stejný důvod jako gettery v
 * user-request.config.ts.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { NavSection } from './welcome-page.interface';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome-page.component.html',
  styleUrl: './welcome-page.component.css',
})
export class WelcomePageComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private profileService = inject(CurrentUserProfileService);
  private cd = inject(ChangeDetectorRef);

  /**
   * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty".
   */
  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('welcome-page'); }
  public t(key: string): string { return this.i18n.getValue(`welcome-page.${key}`); }

  userData: UserLogin | null = null;
  userEmail: string | null = null;
  userRole: string | null = null;

  isLoadingProfile = true;
  errorMessage: string | null = null;

  /**
   * @description Rychlý odkaz na nahlášení chyby - stejný tvar (NavSection) jako karty
   * na Dashboardu. Getter, ne `readonly` pole - viz refactor-note (2026-09) v hlavičce
   * souboru (i18n hodnoty musí být čerstvé, ne zafixované při definici třídy).
   */
  get helpSection(): NavSection {
    return {
      title: this.t('report_bug_title'),
      icon: '🐞',
      route: '/admin/intranet/knowledge-base/support-form',
      description: this.t('report_bug_description'),
      color: 'rose',
    };
  }

  private emailSub?: Subscription;

  constructor() {
    // Po přepnutí admin jazyka donutí komponentu přehodnotit `strings`/`helpSection`/
    // `currentDateTime` výstup - stejný důvod jako u AdminLayoutComponent, jen řešeno
    // ručně (tahle komponenta i18n službu nedědí přes BaseDataComponent).
    this.i18n.translations$.subscribe(() => this.cd.markForCheck());
  }

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();

    this.emailSub = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cd.markForCheck();
    });

    this.loadUserProfile();
  }

  /**
   * @description Načte profil aktuálně přihlášeného uživatele (jméno, datum vytvoření
   * účtu) přes sdílenou TTL-cached `CurrentUserProfileService` (viz refactor-note
   * v hlavičce souboru).
   */
  private loadUserProfile(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.isLoadingProfile = false;
      return;
    }

    this.profileService.getProfile().subscribe({
      next: (response) => {
        this.userData = (response as any)?.data ?? response;
        this.isLoadingProfile = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.errorMessage = this.t('profile_load_error');
        this.isLoadingProfile = false;
        this.cd.markForCheck();
      }
    });
  }

  get welcomeMessage(): string {
    const name = this.userData?.full_name ?? this.userEmail ?? this.t('welcome_default_name');
    return this.t('welcome_message').replace('{name}', name);
  }

  /**
   * @refactor-note (2026-09) BUGFIX - natvrdo `'cs-CZ'` nahrazeno
   * `this.i18n.getDateLocale()` - viz hlavička souboru. Vyžaduje odpovídající
   * `registerLocaleData()` v app.config.ts pro každý podporovaný jazyk (už hotovo
   * pro cz/en, viz app.config.ts refactor-note 2026-09).
   */
  get currentDateTime(): string {
    return new Date().toLocaleDateString(this.i18n.getDateLocale(), {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  /**
   * @refactor-note (2026-09) BUGFIX - stejná oprava jako `currentDateTime` výše.
   */
  formatDate(iso?: string | null): string {
    if (!iso) return this.t('empty_value');
    return new Date(iso).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  ngOnDestroy(): void {
    this.emailSub?.unsubscribe();
  }
}