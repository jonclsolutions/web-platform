/**
 * @file loading.service.ts
 * @path src/app/shared/services/loading.service.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Global service to manage and track the application's loading state.
 * @dependencies
 * - NgZone: Ensures state changes trigger change detection outside of standard Angular event loops when necessary.
 */

import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * @description Provides a centralized observable stream for global loading indicators.
 * @usage Used by the LoadingInterceptor to toggle global UI states based on active HTTP requests.
 * @note Uses NgZone to safely update the loading state across the asynchronous boundary of Promises.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _isLoading$ = new BehaviorSubject<boolean>(false);
  
  /**
   * @description Observable stream of the current loading status.
   */
  public isLoading$ = this._isLoading$.asObservable();

  /**
   * @description Returns the current loading state without subscribing.
   * @note Useful for quick checks in guards or specific UI logic.
   */
  get isLoadingSnapshot(): boolean {
    return this._isLoading$.value;
  }

  constructor(private ngZone: NgZone) {}

  /**
   * @description Triggers the loading state to 'true'.
   * @note Wrapped in NgZone and Promise.resolve to prevent 'ExpressionChangedAfterItHasBeenCheckedError' by deferring the update.
   */
  show() {
    this.ngZone.run(() => {
      Promise.resolve().then(() => this._isLoading$.next(true));
    });
  }

  /**
   * @description Triggers the loading state to 'false'.
   * @note Wrapped in NgZone and Promise.resolve to ensure consistent UI updates after async tasks complete.
   */
  hide() {
    this.ngZone.run(() => {
      Promise.resolve().then(() => this._isLoading$.next(false));
    });
  }
}