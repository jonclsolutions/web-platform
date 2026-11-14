/**
 * @file legal-document-dialog.component.spec.ts
 * @path src/app/public/legal/legal-document-dialog/legal-document-dialog.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LegalDocumentDialogComponent: loading the document of the slug and
 *   language, the error text, closing (button, backdrop, Escape) and the scroll lock.
 * @dependencies LegalDocsService stub (getDocument), ScrollLockService spies.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { LegalDocumentDialogComponent } from './legal-document-dialog.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

describe('LegalDocumentDialogComponent', () => {
  let fixture: ComponentFixture<LegalDocumentDialogComponent>;
  let getDocument: jasmine.Spy;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const el = () => fixture.nativeElement as HTMLElement;

  function create(reply: any): void {
    getDocument = jasmine.createSpy('getDocument').and.returnValue(reply);
    scrollLock = jasmine.createSpyObj('ScrollLockService', ['lock', 'unlock']);
    TestBed.configureTestingModule({
      imports: [LegalDocumentDialogComponent],
      providers: [{ provide: LegalDocsService, useValue: { getDocument } }, { provide: ScrollLockService, useValue: scrollLock }],
    });
    fixture = TestBed.createComponent(LegalDocumentDialogComponent);
    fixture.componentRef.setInput('slug', 'gdpr');
    fixture.componentRef.setInput('lang', 'en');
    fixture.componentRef.setInput('heading', 'Privacy');
    fixture.componentRef.setInput('lastUpdateLabel', 'Updated:');
    fixture.componentRef.setInput('closeLabel', 'Close');
    fixture.componentRef.setInput('errorText', 'Not available');
    fixture.detectChanges();
  }

  /**
   * @description The document of the slug and language is loaded and shown with its date; the page
   *   scroll is locked while open and unlocked on destroy.
   * @input  slug 'gdpr', lang 'en'; reply { last_update_date '01.11.2026', 1 section }
   * @output getDocument('gdpr', 'en'); title 'Privacy'; 'Updated: 01.11.2026'; 1 section; lock, then unlock
   */
  it('loads and shows the document', () => {
    create(of({ last_update_date: '01.11.2026', sections: [{ id: 1, heading: 'A', content: 'x' }] }));
    expect(getDocument).toHaveBeenCalledWith('gdpr', 'en');
    expect(el().querySelector('.ldd-title')!.textContent).toContain('Privacy');
    expect(el().querySelector('.ldd-updated')!.textContent).toContain('Updated: 01.11.2026');
    expect(el().querySelectorAll('.legal-section').length).toBe(1);
    expect(scrollLock.lock).toHaveBeenCalled();
    fixture.destroy();
    expect(scrollLock.unlock).toHaveBeenCalled();
  });

  /**
   * @description A spinner while loading; a missing document shows the error text.
   * @input  pending reply, then null
   * @output spinner; 'Not available'
   */
  it('shows loading and the error text', () => {
    const reply = new Subject<any>();
    create(reply);
    expect(el().querySelector('.ldd-spinner')).not.toBeNull();
    reply.next(null);
    fixture.detectChanges();
    expect(el().querySelector('.ldd-state')!.textContent).toContain('Not available');
  });

  /**
   * @description The close button, the backdrop and Escape close the window.
   * @input  click .ldd-close; click .ldd-backdrop; keydown Escape
   * @output closed emitted 3 times
   */
  it('closes by the button, the backdrop and Escape', () => {
    create(of({ sections: [] }));
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);
    (el().querySelector('.ldd-close') as HTMLButtonElement).click();
    (el().querySelector('.ldd-backdrop') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toHaveBeenCalledTimes(3);
  });
});
