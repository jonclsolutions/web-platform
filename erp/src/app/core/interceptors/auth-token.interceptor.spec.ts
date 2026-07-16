import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { AuthTokenInterceptor } from './auth-token.interceptor';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

describe('AuthTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['getAccessToken', 'refreshAccessToken', 'clearAuthData']);
    const routerMock = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthTokenInterceptor, multi: true },
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerMock }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  it('should be created', () => {
    const interceptor = TestBed.inject(AuthTokenInterceptor);
    expect(interceptor).toBeTruthy();
  });

  it('should add Authorization header to request', () => {
    authServiceSpy.getAccessToken.and.returnValue('mock-token');

    http.get('/test').subscribe();

    const req = httpMock.expectOne('/test');
    expect(req.request.headers.has('Authorization')).toBeTrue();
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
  });
});