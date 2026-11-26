/**
 * @file text-editor-location-strategy.ts
 * @path src/app/public/text-editor/text-editor-location-strategy.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Location strategy of the application (path URLs). In the frame of the visual text
 *   editor of the admin the website never adds entries to the history of the browser tab: the
 *   frame shares that history with the admin, so a page opened in the preview (a link, a detail)
 *   would otherwise be the target of the Back button instead of leaving the editor, and a step
 *   back in the frame could show another page / language than the editor works with. There every
 *   new page replaces the current entry and the website itself never moves in the history (Back,
 *   Forward and `history.go` are the admin's). Everywhere else exactly PathLocationStrategy.
 * @usage `{ provide: LocationStrategy, useClass: TextEditorLocationStrategy }` (app.config).
 * @dependencies PathLocationStrategy, isTextEditorFrame (public-text-editor.service)
 */

import { Injectable } from '@angular/core';
import { PathLocationStrategy } from '@angular/common';
import { isTextEditorFrame } from './public-text-editor.service';

@Injectable()
export class TextEditorLocationStrategy extends PathLocationStrategy {
  /** The application runs in the frame of the visual text editor. */
  protected readonly inEditorFrame: boolean = typeof window !== 'undefined' && isTextEditorFrame(window);

  /**
   * @description A new page: a new entry of the history - in the editor frame it replaces the
   *   current one instead.
   * @param state History state (router page id).
   * @param title Title.
   * @param url Path.
   * @param queryParams Query.
   */
  override pushState(state: any, title: string, url: string, queryParams: string): void {
    if (this.inEditorFrame) {
      this.replaceState(state, title, url, queryParams);
      return;
    }
    super.pushState(state, title, url, queryParams);
  }

  /** @description Back in the history - never from the editor frame (the history is the admin's). */
  override back(): void {
    if (!this.inEditorFrame) super.back();
  }

  /** @description Forward in the history - never from the editor frame. */
  override forward(): void {
    if (!this.inEditorFrame) super.forward();
  }

  /**
   * @description A step in the history (the router restoring a cancelled navigation) - never from
   *   the editor frame: it would move the admin.
   * @param relativePosition Steps.
   */
  override historyGo(relativePosition = 0): void {
    if (!this.inEditorFrame) super.historyGo(relativePosition);
  }
}
