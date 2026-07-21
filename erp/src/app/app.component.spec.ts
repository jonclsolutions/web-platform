/**
 * @file app.component.spec.ts
 * @path src/app/app.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Unit tests for AppComponent.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { PublicDataService } from './shared/services/public-data.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let publicDataServiceSpy: jasmine.SpyObj<PublicDataService>;

  beforeEach(async () => {
    // Vytvoření mocků pro služby volané v ngOnInit
    const authSpy = jasmine.createSpyObj('AuthService', ['checkAuth']);
    authSpy.checkAuth.and.returnValue(of({}));

    const publicSpy = jasmine.createSpyObj('PublicDataService', ['get', 'getStorageUrl']);
    publicSpy.get.and.returnValue(of({ settings: { logo_path: 'path/to/logo.png' } }));
    publicSpy.getStorageUrl.and.returnValue('http://localhost/storage/path/to/logo.png');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
        { provide: PublicDataService, useValue: publicSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    publicDataServiceSpy = TestBed.inject(PublicDataService) as jasmine.SpyObj<PublicDataService>;
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should call checkAuth and fetch public settings on init', () => {
    fixture.detectChanges(); // Spustí ngOnInit

    expect(authServiceSpy.checkAuth).toHaveBeenCalled();
    expect(publicDataServiceSpy.get).toHaveBeenCalledWith('public/legal/config');
  });

  it('should update favicon when logo_path is present in settings', () => {
    fixture.detectChanges();

    expect(publicDataServiceSpy.getStorageUrl).toHaveBeenCalledWith('path/to/logo.png');
    
    const faviconLink = document.querySelector('#dynamic-favicon') as HTMLLinkElement;
    expect(faviconLink).toBeTruthy();
    expect(faviconLink.rel).toBe('icon');
    expect(faviconLink.href).toContain('path/to/logo.png');
  });

  it('should render router-outlet', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});