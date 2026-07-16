/**
 * @file base-data.component.spec.ts
 * @path src/app/admin/components/base-data/base-data.component.spec.ts
 * @project RPSW Web
 * @description Unit tests for {@link BaseDataComponent}.
 *
 * `BaseDataComponent` is an abstract `@Directive()` class, so it cannot be
 * instantiated or bootstrapped directly by `TestBed.createComponent`. To test
 * it we declare a minimal, concrete **host component** (`TestHostComponent`)
 * that extends it and only supplies the abstract `apiEndpoint` member.
 *
 * The component delegates almost all of its behaviour to two lazily created
 * collaborators, exposed as protected getters:
 *   - `crud` → an `EntityCrudService<T>` instance (single-entity CRUD calls)
 *   - `list` → a `PaginatedListStore<T>` instance (pagination / cache / trash)
 *
 * Rather than re-testing those collaborators here (they have their own spec
 * files), we stub the `crud` / `list` getters with `spyOnProperty(...).and
 * .returnValue(...)`. This lets us verify, in isolation, that
 * `BaseDataComponent` delegates calls with the correct arguments and that its
 * own pass-through / error-handling logic behaves as documented.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectorRef } from '@angular/core';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import * as Core from '../../shared/imports/core-providers';

import { BaseDataComponent } from '../../admin/components/base-data/base-data.component';
import { EntityCrudService } from './entitiy-crud.service';
import { PaginatedListStore } from '../../admin/components/base-data/paginated-list-store';
/**
 * @description Minimal shape used as the generic `T` for the test host.
 * Only the fields required by `BaseDataComponent<T>`'s constraint
 * (`{ id?: number; deleted_at?: string | null }`) plus a couple of extra
 * fields to make assertions more concrete.
 */
interface TestEntity {
  id?: number;
  deleted_at?: string | null;
  name?: string;
}

/**
 * @description Concrete, standalone host component used purely for testing.
 * It contributes nothing beyond the mandatory `apiEndpoint`, so any behaviour
 * observed in the tests can be attributed to `BaseDataComponent` itself.
 */
@Component({
  standalone: true,
  selector: 'app-test-base-data',
  template: ''
})
class TestHostComponent extends BaseDataComponent<TestEntity> {
  apiEndpoint = 'test-entities';

  public getCdForTest(): ChangeDetectorRef { return this.cd; }
  public getDefaultFiltersForTest(): any { return this.defaultFilters; }
}

describe('BaseDataComponent', () => {
  let component: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;

  /** Spy standing in for the lazily built `EntityCrudService<TestEntity>`. */
  let crudSpy: jasmine.SpyObj<EntityCrudService<TestEntity>>;
  /** Spy standing in for the lazily built `PaginatedListStore<TestEntity>`. */
  let listSpy: jasmine.SpyObj<PaginatedListStore<TestEntity>>;

  /** Mock for `AuthService`, exposing a controllable `isLoggedIn$` stream. */
  let authServiceMock: { isLoggedIn$: BehaviorSubject<boolean> };
  /** Mock for `Router`, used to assert navigation on failed auth checks. */
  let routerSpy: jasmine.SpyObj<Router>;

  /**
   * @description Builds a fresh `EntityCrudService` spy with every method the
   * component delegates to (`getCollection`, `getOne`, `create`, `update`,
   * `remove`, `restore`, `upload`, `updatePassword`, `loadAll`,
   * `hardDeleteAllTrashed`), each defaulting to an empty/`of(...)` observable.
   * @returns A jasmine spy object matching `EntityCrudService<TestEntity>`'s
   * public surface.
   */
  function createCrudSpy(): jasmine.SpyObj<EntityCrudService<TestEntity>> {
    const spy = jasmine.createSpyObj<EntityCrudService<TestEntity>>('EntityCrudService', [
      'getCollection',
      'getOne',
      'create',
      'update',
      'remove',
      'restore',
      'upload',
      'updatePassword',
      'loadAll',
      'hardDeleteAllTrashed'
    ]);
    spy.getCollection.and.returnValue(of([]));
    spy.getOne.and.returnValue(of({} as TestEntity));
    spy.create.and.returnValue(of({} as TestEntity));
    spy.update.and.returnValue(of({} as TestEntity));
    spy.remove.and.returnValue(of(undefined));
    spy.restore.and.returnValue(of({} as TestEntity));
    spy.upload.and.returnValue(of({}));
    spy.updatePassword.and.returnValue(of({}));
    spy.loadAll.and.returnValue(of([]));
    spy.hardDeleteAllTrashed.and.returnValue(of(undefined));
    return spy;
  }

  /**
   * @description Builds a fresh `PaginatedListStore` spy with every method
   * the component delegates to, plus every pass-through property the
   * component re-exposes as getters/setters (`data`, `trashData`,
   * `showTrashTable`, pagination counters, and active/trash filters).
   * @returns A jasmine spy object matching `PaginatedListStore<TestEntity>`'s
   * public surface.
   */
  function createListSpy(): jasmine.SpyObj<PaginatedListStore<TestEntity>> {
    return jasmine.createSpyObj<PaginatedListStore<TestEntity>>(
      'PaginatedListStore',
      ['forceFullRefresh', 'onHandlePageChange', 'onHandleItemsPerPageChange', 'toggleTable'],
      {
        data: [],
        trashData: [],
        showTrashTable: false,
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        totalPages: 0,
        trashCurrentPage: 1,
        trashItemsPerPage: 10,
        trashTotalItems: 0,
        trashTotalPages: 0,
        currentActiveFilters: { sort_by: 'id', sort_direction: 'desc' },
        currentTrashFilters: { sort_by: 'id', sort_direction: 'desc' }
      }
    );
  }

  beforeEach(async () => {
    authServiceMock = { isLoggedIn$: new BehaviorSubject<boolean>(false) };
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: Core.DataHandler, useValue: jasmine.createSpyObj('DataHandler', ['get', 'post', 'put', 'delete']) },
        { provide: Core.GenericTableService, useValue: jasmine.createSpyObj('GenericTableService', ['getPage']) },
        { provide: Core.LoadingService, useValue: jasmine.createSpyObj('LoadingService', ['show', 'hide']) },
        { provide: Core.AlertDialogService, useValue: jasmine.createSpyObj('AlertDialogService', ['open', 'confirm']) },
        { provide: Core.AuthService, useValue: authServiceMock },
        { provide: Core.PermissionService, useValue: jasmine.createSpyObj('PermissionService', ['can']) },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;

    // Replace the lazily-instantiated collaborators with test doubles
    // *before* anything touches `component.data` / `component.crud`, so the
    // real `EntityCrudService` / `PaginatedListStore` constructors never run.
    crudSpy = createCrudSpy();
    listSpy = createListSpy();
    spyOnProperty<any>(component, 'crud', 'get').and.returnValue(crudSpy);
    spyOnProperty<any>(component, 'list', 'get').and.returnValue(listSpy);

    fixture.detectChanges();
  });

  /** @description Sanity check that the host (and therefore the base class) instantiates. */
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * @description Verifies the plain UI-state flags declared directly on
   * `BaseDataComponent` (not delegated anywhere) start with their documented
   * default values.
   */
  describe('initial UI state', () => {
    it('should default isTableFullWidth to true', () => {
      expect(component.isTableFullWidth).toBeTrue();
    });

    it('should default isFilterVisible, showCreateForm and showDetails to false', () => {
      expect(component.isFilterVisible).toBeFalse();
      expect(component.showCreateForm).toBeFalse();
      expect(component.showDetails).toBeFalse();
    });

    it('should default errorMessage to null', () => {
      expect(component.errorMessage).toBeNull();
    });
  });

  /** @description `toggleFilters()` only flips a local boolean; nothing is delegated. */
  describe('toggleFilters()', () => {
    it('should flip isFilterVisible from false to true and back', () => {
      expect(component.isFilterVisible).toBeFalse();

      component.toggleFilters();
      expect(component.isFilterVisible).toBeTrue();

      component.toggleFilters();
      expect(component.isFilterVisible).toBeFalse();
    });
  });

  /**
   * @description Confirms every `data`/pagination/trash property is a thin
   * pass-through to the `list` collaborator (`PaginatedListStore`), in both
   * the getter and setter direction.
   */
  describe('list pass-through properties', () => {
    it('should read "data" from the list store', () => {
      const rows: TestEntity[] = [{ id: 1, name: 'Alpha' }];
      (listSpy as any).data = rows;
      expect(component.data).toEqual(rows);
    });

    it('should write "data" through to the list store', () => {
      const rows: TestEntity[] = [{ id: 2, name: 'Beta' }];
      component.data = rows;
      expect(listSpy.data).toEqual(rows);
    });

    it('should read/write "trashData"', () => {
      const rows: TestEntity[] = [{ id: 3, deleted_at: '2025-01-01' }];
      component.trashData = rows;
      expect(listSpy.trashData).toEqual(rows);
      (listSpy as any).trashData = rows;
      expect(component.trashData).toEqual(rows);
    });

    it('should read/write "showTrashTable"', () => {
      component.showTrashTable = true;
      expect(listSpy.showTrashTable).toBeTrue();
    });

    it('should read/write pagination counters for the active table', () => {
      component.currentPage = 3;
      component.itemsPerPage = 25;
      component.totalItems = 100;
      component.totalPages = 4;

      expect(listSpy.currentPage).toBe(3);
      expect(listSpy.itemsPerPage).toBe(25);
      expect(listSpy.totalItems).toBe(100);
      expect(listSpy.totalPages).toBe(4);
    });

    it('should read/write pagination counters for the trash table', () => {
      component.trashCurrentPage = 2;
      component.trashItemsPerPage = 15;
      component.trashTotalItems = 30;
      component.trashTotalPages = 2;

      expect(listSpy.trashCurrentPage).toBe(2);
      expect(listSpy.trashItemsPerPage).toBe(15);
      expect(listSpy.trashTotalItems).toBe(30);
      expect(listSpy.trashTotalPages).toBe(2);
    });

    it('should expose currentActiveFilters and currentTrashFilters from the list store', () => {
      expect((component as any).currentActiveFilters).toEqual(listSpy.currentActiveFilters);
      expect((component as any).currentTrashFilters).toEqual(listSpy.currentTrashFilters);
    });
  });

  /**
   * @description Verifies the pagination/trash-toggle methods are forwarded
   * verbatim to the `list` collaborator, defaulting to the component's own
   * `currentActiveFilters` when no explicit filters are supplied.
   */
  describe('pagination / trash delegation', () => {
    it('forceFullRefresh() should delegate to list.forceFullRefresh with the given filters', () => {
      const filters = { sort_by: 'name', sort_direction: 'asc' as const };
      component.forceFullRefresh(filters);
      expect(listSpy.forceFullRefresh).toHaveBeenCalledWith(filters);
    });

    it('forceFullRefresh() should fall back to defaultFilters when called without arguments', () => {
      component.forceFullRefresh();
      expect(listSpy.forceFullRefresh).toHaveBeenCalledWith(component.getDefaultFiltersForTest() as any);
    });

    it('onHandlePageChange() should delegate to list.onHandlePageChange', () => {
      const filters = listSpy.currentActiveFilters;
      component.onHandlePageChange(5, filters);
      expect(listSpy.onHandlePageChange).toHaveBeenCalledWith(5, filters);
    });

    it('onHandleItemsPerPageChange() should delegate to list.onHandleItemsPerPageChange', () => {
      const filters = listSpy.currentActiveFilters;
      component.onHandleItemsPerPageChange(50, filters);
      expect(listSpy.onHandleItemsPerPageChange).toHaveBeenCalledWith(50, filters);
    });

    it('toggleTable() should delegate to list.toggleTable', () => {
      component.toggleTable();
      expect(listSpy.toggleTable).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * @description `loadData()` is the one method that talks to `crud`
   * directly instead of going through `list`; it guards against a missing
   * `apiEndpoint` and otherwise assigns the fetched collection to `data`.
   */
  describe('loadData()', () => {
    it('should set errorMessage and skip the request when apiEndpoint is falsy', () => {
      component.apiEndpoint = '' as any;

      component.loadData();

      expect(component.errorMessage).toBe('Error: API endpoint undefined.');
      expect(crudSpy.getCollection).not.toHaveBeenCalled();
    });

    it('should populate "data" from crud.getCollection() when apiEndpoint is set', () => {
      const rows: TestEntity[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
      crudSpy.getCollection.and.returnValue(of(rows));

      component.loadData();

      expect(crudSpy.getCollection).toHaveBeenCalledTimes(1);
      expect(listSpy.data).toEqual(rows);
    });
  });

  /**
   * @description Each single-entity CRUD method should be a one-to-one
   * delegation to the matching `EntityCrudService` method, preserving both
   * arguments and the returned observable's emitted value.
   */
  describe('single-entity CRUD delegation', () => {
    it('getItemDetails() should delegate to crud.getOne(id)', (done) => {
      const entity: TestEntity = { id: 7, name: 'Gamma' };
      crudSpy.getOne.and.returnValue(of(entity));

      component.getItemDetails(7).subscribe(result => {
        expect(crudSpy.getOne).toHaveBeenCalledWith(7);
        expect(result).toEqual(entity);
        done();
      });
    });

    it('postData() should delegate to crud.create(data)', (done) => {
      const payload: TestEntity = { name: 'New item' };
      const created: TestEntity = { id: 10, name: 'New item' };
      crudSpy.create.and.returnValue(of(created));

      component.postData(payload).subscribe(result => {
        expect(crudSpy.create).toHaveBeenCalledWith(payload);
        expect(result).toEqual(created);
        done();
      });
    });

    it('updateData() should delegate to crud.update(id, data)', (done) => {
      const payload: TestEntity = { id: 11, name: 'Updated' };
      crudSpy.update.and.returnValue(of(payload));

      component.updateData(11, payload).subscribe(result => {
        expect(crudSpy.update).toHaveBeenCalledWith(11, payload);
        expect(result).toEqual(payload);
        done();
      });
    });

    it('deleteData() should delegate to crud.remove(id, { forceDelete, params })', (done) => {
      const params = { reason: 'cleanup' };
      crudSpy.remove.and.returnValue(of(undefined));

      component.deleteData(12, true, params).subscribe(() => {
        expect(crudSpy.remove).toHaveBeenCalledWith(12, { forceDelete: true, params });
        done();
      });
    });

    it('restoreDataFromApi() should delegate to crud.restore(id)', (done) => {
      const restored: TestEntity = { id: 13, deleted_at: null };
      crudSpy.restore.and.returnValue(of(restored));

      component.restoreDataFromApi(13).subscribe(result => {
        expect(crudSpy.restore).toHaveBeenCalledWith(13);
        expect(result).toEqual(restored);
        done();
      });
    });

    it('uploadData() should delegate to crud.upload(formData, targetUrl)', (done) => {
      const formData = new FormData();
      const response = { url: 'https://example.com/file.png' };
      crudSpy.upload.and.returnValue(of(response));

      component.uploadData(formData, '/custom-upload').subscribe(result => {
        expect(crudSpy.upload).toHaveBeenCalledWith(formData, '/custom-upload');
        expect(result).toEqual(response);
        done();
      });
    });

    it('loadAllData() should delegate to crud.loadAll(filters) when apiEndpoint is set', (done) => {
      const rows: TestEntity[] = [{ id: 1 }, { id: 2 }];
      const filters = { sort_by: 'name', sort_direction: 'asc' as const };
      crudSpy.loadAll.and.returnValue(of(rows));

      component.loadAllData(filters).subscribe(result => {
        expect(crudSpy.loadAll).toHaveBeenCalledWith(filters);
        expect(result).toEqual(rows);
        done();
      });
    });

    it('loadAllData() should error without calling crud.loadAll when apiEndpoint is missing', (done) => {
      component.apiEndpoint = '' as any;

      component.loadAllData().subscribe({
        error: (err) => {
          expect(err.message).toBe('API endpoint undefined.');
          expect(crudSpy.loadAll).not.toHaveBeenCalled();
          done();
        }
      });
    });
  });

  /**
   * @description `updatePassword()` adds error-handling on top of the plain
   * delegation: on success it simply forwards the emission; on failure it
   * records a user-facing `errorMessage`, triggers change detection, and
   * re-throws so callers can still react to the failure.
   */
  describe('updatePassword()', () => {
    it('should clear errorMessage and return the crud result on success', (done) => {
      const response = { success: true };
      crudSpy.updatePassword.and.returnValue(of(response));
      component.errorMessage = 'stale error';

      component.updatePassword(1, { password: 'new-pass' }).subscribe(result => {
        expect(component.errorMessage).toBeNull();
        expect(crudSpy.updatePassword).toHaveBeenCalledWith(1, { password: 'new-pass' });
        expect(result).toEqual(response);
        done();
      });
    });

    it('should set errorMessage, mark for check, and rethrow on failure', (done) => {
      const httpError = new HttpErrorResponse({ error: 'boom', status: 500 });
      crudSpy.updatePassword.and.returnValue(throwError(() => httpError));
      const markForCheckSpy = spyOn(component.getCdForTest(), 'markForCheck');

      component.updatePassword(1, { password: 'new-pass' }).subscribe({
        error: (err) => {
          expect(component.errorMessage).toBe(httpError.message);
          expect(markForCheckSpy).toHaveBeenCalled();
          expect(err).toBe(httpError);
          done();
        }
      });
    });

    it('should fall back to a generic message when the error has no message', (done) => {
      const httpError = { message: '' } as HttpErrorResponse;
      crudSpy.updatePassword.and.returnValue(throwError(() => httpError));

      component.updatePassword(1, {}).subscribe({
        error: () => {
          expect(component.errorMessage).toBe('Error changing password.');
          done();
        }
      });
    });
  });

  /**
   * @description `hardDeleteAllTrashedDataFromApi()` mirrors `updatePassword()`'s
   * error-handling pattern but additionally guards against a missing
   * `apiEndpoint` before ever touching `crud`.
   */
  describe('hardDeleteAllTrashedDataFromApi()', () => {
    it('should error immediately when apiEndpoint is missing, without calling crud', (done) => {
      component.apiEndpoint = '' as any;

      component.hardDeleteAllTrashedDataFromApi().subscribe({
        error: (err) => {
          expect(err.message).toBe('API endpoint undefined.');
          expect(crudSpy.hardDeleteAllTrashed).not.toHaveBeenCalled();
          done();
        }
      });
    });

    it('should clear errorMessage and delegate to crud.hardDeleteAllTrashed() on success', (done) => {
      crudSpy.hardDeleteAllTrashed.and.returnValue(of(undefined));
      component.errorMessage = 'stale error';

      component.hardDeleteAllTrashedDataFromApi().subscribe(() => {
        expect(component.errorMessage).toBeNull();
        expect(crudSpy.hardDeleteAllTrashed).toHaveBeenCalledTimes(1);
        done();
      });
    });

    it('should set errorMessage and mark for check on failure', (done) => {
      const httpError = new HttpErrorResponse({ error: 'boom', status: 500 });
      crudSpy.hardDeleteAllTrashed.and.returnValue(throwError(() => httpError));
      const markForCheckSpy = spyOn(component.getCdForTest(), 'markForCheck');
      
      component.hardDeleteAllTrashedDataFromApi().subscribe({
        error: (err) => {
          expect(component.errorMessage).toBe(httpError.message);
          expect(markForCheckSpy).toHaveBeenCalled();
          expect(err).toBe(httpError);
          done();
        }
      });
    });
  });

  /**
   * @description `initWithAuthCheck()` subscribes to `AuthService.isLoggedIn$`
   * and either reloads data or redirects to the login page, depending on the
   * emitted authentication state.
   */
  describe('initWithAuthCheck()', () => {
    it('should call refreshData() when the user is logged in', () => {
      const refreshSpy = spyOn(component, 'refreshData');

      (component as any).initWithAuthCheck(routerSpy);
      authServiceMock.isLoggedIn$.next(true);

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should navigate to /auth/login when the user is not logged in', () => {
      const refreshSpy = spyOn(component, 'refreshData');

      (component as any).initWithAuthCheck(routerSpy);
      authServiceMock.isLoggedIn$.next(false);

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should unsubscribe once destroy$ has emitted, so later auth changes are ignored', () => {
      const refreshSpy = spyOn(component, 'refreshData');

      (component as any).initWithAuthCheck(routerSpy);
      component.ngOnDestroy();
      authServiceMock.isLoggedIn$.next(true);

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  /**
   * @description `ngOnDestroy()` must complete the shared `destroy$` subject
   * so that both the component's own subscriptions and any subscriptions
   * held by `crud`/`list` (which receive the same subject) are torn down.
   */
  describe('ngOnDestroy()', () => {
    it('should call next() and complete() on destroy$', () => {
      const destroy$ = (component as any).destroy$;
      const nextSpy = spyOn(destroy$, 'next').and.callThrough();
      const completeSpy = spyOn(destroy$, 'complete').and.callThrough();

      component.ngOnDestroy();

      expect(nextSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledTimes(1);
    });
  });
});