/**
 * @file legal-document-sections.component.spec.ts
 * @path src/app/public/legal/legal-document-sections/legal-document-sections.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LegalDocumentSectionsComponent: headings, HTML content, subsections
 *   with text and bullets; nothing for an empty document.
 * @dependencies none (plain inputs).
 */

import { TestBed } from '@angular/core/testing';
import { LegalDocumentSectionsComponent } from './legal-document-sections.component';

describe('LegalDocumentSectionsComponent', () => {
  /**
   * @description Every section shows its heading and HTML; a subsection its heading, text and bullets.
   * @input  [{ heading 'A', content '<p><strong>x</strong></p>', subsection 'A1' text + 2 bullets }, { heading 'B' }]
   * @output h2 A, B; strong 'x'; h3 'A1'; 2 li; empty input → no section
   */
  it('renders the sections of a document', () => {
    const fixture = TestBed.createComponent(LegalDocumentSectionsComponent);
    fixture.componentRef.setInput('sections', [
      { id: 1, heading: 'A', content: '<p><strong>x</strong></p>', subsections: [{ id: 11, heading: 'A1', text: 'Text', list: ['one', 'two'] }] },
      { id: 2, heading: 'B', content: '', subsections: null },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('h2')).map(h => h.textContent)).toEqual(['A', 'B']);
    expect(el.querySelector('.legal-section strong')!.textContent).toBe('x');
    expect(el.querySelector('h3')!.textContent).toBe('A1');
    expect(el.querySelectorAll('li').length).toBe(2);

    fixture.componentRef.setInput('sections', []);
    fixture.detectChanges();
    expect(el.querySelector('.legal-section')).toBeNull();
  });
});
