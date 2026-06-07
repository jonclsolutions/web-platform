import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as Web from '../../../shared/imports/web-providers';
import { GenericFormComponent } from '../components/generic-form/generic-form.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    GenericFormComponent
]
})
export class HomeComponent implements Web.OnInit, Web.OnDestroy {
  // --- Překlady ---
  t: any = null;
  private destroy$ = new Web.Subject<void>();

  // --- Konfigurace formuláře ---
  contactFormConfig: Web.FormFieldConfig[] = [];

  // --- Statické assety ---
  private heroBackgroundImageUrl: string = 'assets/images/backgrounds/home_background.jpg';
  private serviceBackgrounds: { [key: string]: string } = {
    webapp: 'assets/images/backgrounds/service-web.jpg',
    desktopapp: 'assets/images/backgrounds/service-desktop.jpg',
    mobileapp: 'assets/images/backgrounds/service-mobile.jpg',
    aiapp: 'assets/images/backgrounds/service-ai.jpg',
  };
  
  phone_icon: string = 'assets/images/icons/call.png';
  mail_icon: string = 'assets/images/icons/mail.png';
  send_icon: string = 'assets/images/icons/send.png';
  eshop_default: string = 'assets/images/product_images/admin_panel.png';
  survey_engine: string = 'assets/images/product_images/survey_engine.png';
  survey_solver: string = 'assets/images/product_images/survey_solver.png';
  check_mark: string = 'assets/images/icons/check.png';
  py: string = 'assets/images/icons/curses/py.png';
  scratch: string = 'assets/images/icons/curses/scratch.png';
  csharp: string = 'assets/images/icons/curses/csharp.png';
  js: string = 'assets/images/icons/curses/js.png';

  hoverState: { [key: string]: boolean } = {
    webapp: false,
    website: false,
    desktopapp: false,
    graphicdesign: false,
  };

  constructor(
    private publicDataService: Web.PublicDataService, 
    private localizationService: Web.LocalizationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations && Object.keys(translations).length > 0) {
          // Uložíme celou sekci 'home' pro přístup v HTML přes t.neco
          this.t = translations.home;
          
          // Sestavení konfigurace formuláře s aktuálními překlady
          this.buildContactForm();
          
          this.cdr.detectChanges();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Sestaví konfiguraci formuláře s využitím načtených překladů
   */
  private buildContactForm(): void {
    this.contactFormConfig = [
      {
        label: this.localizationService.getText('home.form_topic_label'),
        name: 'thema',
        type: 'select',
        required: true,
        value: 'Webový vývoj',
        options: [
          { value: 'Webový vývoj', label: this.localizationService.getText('home.form_topic_option_web') },
          { value: 'Desktopový vývoj', label: this.localizationService.getText('home.form_topic_option_desktop') },
          { value: 'Mobilní vývoj', label: this.localizationService.getText('home.form_topic_option_mobile') },
          { value: 'AI vývoj', label: this.localizationService.getText('home.form_topic_option_ai') },
          { value: 'Jiné', label: this.localizationService.getText('home.form_topic_option_other') }
        ]
      },
      {
        label: this.localizationService.getText('home.form_email_label'),
        name: 'contact_email',
        type: 'email',
        required: true,
        placeholder: this.localizationService.getText('home.form_email_placeholder'),
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$'
      },
      {
        label: this.localizationService.getText('home.form_phone_label'),
        name: 'contact_phone',
        type: 'tel',
        required: false,
        placeholder: this.localizationService.getText('home.form_phone_placeholder'),
        pattern: '^[0-9\\s\\-+\\(\\)]+$'
      },
      {
        label: this.localizationService.getText('home.form_description_label'),
        name: 'order_description',
        type: 'textarea',
        required: true,
        rows: 5,
        placeholder: this.localizationService.getText('home.form_description_placeholder')
      }
    ];
  }

  handleFormSubmission(formData: any): void {
    this.publicDataService.submitContactForm(formData).pipe(Web.takeUntil(this.destroy$)).subscribe({
      next: (response) => { /* Success logic */ },
      error: (error: Web.HttpErrorResponse) => { /* Error logic */ }
    });
  }

  handleFormReset(): void {
    // console.log('Formulář resetován');
  }

  // --- Pomocné metody pro UI ---

  getHeroBackground(): string {
    return `url('${this.heroBackgroundImageUrl}')`;
  }

  getServiceBackground(serviceName: string): string {
    return `url('${this.serviceBackgrounds[serviceName]}')`;
  }

  getServiceOverlayStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      filter: isHovered ? 'grayscale(0%) brightness(1)' : 'grayscale(100%) brightness(0.7)',
      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    };
  }

  getTextStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      textShadow: isHovered ? '0 0 15px rgba(0, 188, 212, 0.7)' : 'none',
      transition: 'color 0.4s ease, text-shadow 0.4s ease'
    };
  }

  getArrowStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      opacity: '1',
      transform: isHovered ? 'translateX(20px)' : 'translateX(0px)',
      transition: 'color 0.4s ease, transform 0.4s ease'
    };
  }

  setHoverState(serviceName: string, isHovering: boolean) {
    this.hoverState[serviceName] = isHovering;
  }
}