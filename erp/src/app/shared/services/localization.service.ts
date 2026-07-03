import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiLanguage {
  code: string;
  name: string;
  active: boolean;
  iconUrl?: string;
  isBuiltIn?: boolean;
}

export interface LangMeta {
  code: string;
  label: string;
  flag: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocalizationService {
  private currentModule: string = 'web';
  private readonly API_URL = environment.base_api_url;
  
  private translationsCache = new Map<string, any>();
  private languagesCache: LangMeta[] = [];

  private currentLanguageSource = new BehaviorSubject<string>('cz');
  public currentLanguage$ = this.currentLanguageSource.asObservable();

  private currentTranslationsSource = new BehaviorSubject<any>(null);
  public currentTranslations$ = this.currentTranslationsSource.asObservable();

  constructor(private http: HttpClient) {
    this.init();
  }

  private init(): void {
    const stored = localStorage.getItem('selectedLanguage') || 'cz';
    this.currentLanguageSource.next(stored);
    // Po inicializaci ihned načteme překlady pro výchozí jazyk
    this.loadTranslations(stored);
  }

  public setModule(module: string): void {
    if (this.currentModule !== module) {
      this.currentModule = module;
      this.translationsCache.clear();
      this.fetchLanguages().subscribe(res => {
      });
    }
  }

  public getText(key: string): string {
    const translations = this.currentTranslationsSource.getValue();
    if (!translations) {
      console.warn(`[LocalizationService] Translations not loaded yet for key: ${key}`);
      return key;
    }
    return key.split('.').reduce((acc, part) => acc && acc[part], translations) || key;
  }

  public fetchLanguages(): Observable<{ languages: LangMeta[] }> {
    return this.http.get<{ languages: ApiLanguage[] }>(`${this.API_URL}/languages/${this.currentModule}`).pipe(
      map(res => ({
        languages: res.languages.map((l: ApiLanguage) => ({
          code: l.code,
          label: l.name,
          flag: l.iconUrl || 'assets/images/icons/default.png',
          active: l.active
        }))
      })),
      tap(res => {
        this.languagesCache = res.languages;
      })
    );
  }

  public loadTranslations(lang: string): void {
    
    if (this.translationsCache.has(lang)) {
      this.currentTranslationsSource.next(this.translationsCache.get(lang));
      return;
    }

    const url = `${this.API_URL}/translations/${this.currentModule}/${lang}`;

    this.http.get(url).subscribe({
      next: (data) => {
        this.translationsCache.set(lang, data);
        this.currentTranslationsSource.next(data);
      },
      error: (err) => {
        console.error(`[LocalizationService] ERROR loading translations for ${lang}:`, err);
        if (lang !== 'cz') {
          this.setLanguage('cz');
        }
      }
    });
  }

  public setLanguage(code: string): void {
    localStorage.setItem('selectedLanguage', code);
    this.currentLanguageSource.next(code);
    this.loadTranslations(code);
  }

  public getCurrentLanguage(): string {
    return this.currentLanguageSource.getValue();
  }
}