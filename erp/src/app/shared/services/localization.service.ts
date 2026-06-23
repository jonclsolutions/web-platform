import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs'; 
import { catchError, tap } from 'rxjs/operators'; 

@Injectable({
  providedIn: 'root'
})
//načítá data z cz.json nebo en.json a aktualizuje texty na verejne strance
export class LocalizationService {
  private defaultLanguage: string = 'cz'; 
  private currentLanguageSource = new BehaviorSubject<string>(this.defaultLanguage);
  public currentLanguage$ = this.currentLanguageSource.asObservable();
  private currentTranslationsSource = new BehaviorSubject<any>(null);
  public currentTranslations$: Observable<any> = this.currentTranslationsSource.asObservable();
  private translations: any = {};
  constructor(private http: HttpClient) {
    this.loadInitialLanguage();
    this.currentLanguage$.subscribe(lang => {
      this.loadTranslations(lang);
    });
  }

  private loadInitialLanguage(): void {
    const storedLang = localStorage.getItem('selectedLanguage');
    if (storedLang && ['cz', 'en'].includes(storedLang)) { 
      this.currentLanguageSource.next(storedLang);
    } else {
      this.currentLanguageSource.next(this.defaultLanguage);
    }
  }

  // Přidejte tuto metodu do localization.service.ts
  public getCurrentLanguage(): string {
    return this.currentLanguageSource.getValue();
  }

  private loadTranslations(languageCode: string): void {
    this.http.get(`assets/i18n/${languageCode}.json`).pipe(
      tap(data => {
        this.translations = data;
        this.currentTranslationsSource.next(this.translations);
      }),
      catchError(error => {
        if (languageCode !== this.defaultLanguage) {
          this.loadTranslations(this.defaultLanguage);
        } else {
          this.translations = {};
          this.currentTranslationsSource.next(this.translations);
        }
        return of({});
      })
    ).subscribe();
  }

  public setLanguage(languageCode: string): void {
    if (this.currentLanguageSource.getValue() !== languageCode && ['cz', 'en'].includes(languageCode)) {
      localStorage.setItem('selectedLanguage', languageCode);
      this.currentLanguageSource.next(languageCode);
    }
  }

  public getText(key: string): string {
    const keys = key.split('.');
    let current: any = this.translations;
    for (const k of keys) {
      if (current && typeof current === 'object' && current.hasOwnProperty(k)) {
        current = current[k];
      } else {
        return key;
      }
    }
    return typeof current === 'string' ? current : key;
  }
}