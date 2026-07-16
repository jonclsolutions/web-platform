import { TestBed } from '@angular/core/testing';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let permissionServiceSpy: jasmine.SpyObj<PermissionService>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['checkAuth']);
    const routerMock = jasmine.createSpyObj('Router', ['createUrlTree']);
    const permSpy = jasmine.createSpyObj('PermissionService', ['hasPermission']);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerMock },
        { provide: PermissionService, useValue: permSpy }
      ]
    });

    guard = TestBed.inject(AuthGuard);
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    permissionServiceSpy = TestBed.inject(PermissionService) as jasmine.SpyObj<PermissionService>;
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});