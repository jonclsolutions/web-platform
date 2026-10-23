/**
 * @file loading.service.spec.ts
 * @path src/app/core/services/loading.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of LoadingService: show() / hide() switch isLoading$ asynchronously
 *   (next microtask - avoids ExpressionChanged errors during change detection).
 * @dependencies
 * - fakeAsync + flushMicrotasks.
 */

import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  /**
   * @description The flag changes only after the microtask queue is flushed.
   * @input show(); flush; hide(); flush.
   * @output false → (after flush) true → false.
   */
  it('toggles the loading flag in the next microtask', fakeAsync(() => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(LoadingService);
    const values: boolean[] = [];
    service.isLoading$.subscribe(v => values.push(v));

    service.show();
    expect(values).toEqual([false]);
    flushMicrotasks();
    expect(values).toEqual([false, true]);

    service.hide();
    flushMicrotasks();
    expect(values).toEqual([false, true, false]);
  }));
});
