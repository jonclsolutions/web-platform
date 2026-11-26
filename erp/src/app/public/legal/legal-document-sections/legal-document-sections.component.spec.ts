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
   * @description Every section shows its heading and its content as text (never HTML - a tag stays
   *   text); a subsection its heading, text and bullets (also as text).
   * @input  [{ heading 'A', content 'x\n\ny <img onerror>', subsection 'A1' text + bullets 'one', '<b>two</b>' }, { heading 'B' }]
   * @output h2 A, B; the content text with its new lines, no img / b element; h3 'A1'; 2 li;
   *   empty input → no section
   */
  it('renders the sections of a document', () => {
    const fixture = TestBed.createComponent(LegalDocumentSectionsComponent);
    fixture.componentRef.setInput('sections', [
      { id: 1, heading: 'A', content: 'x\n\ny <img src=x onerror=alert(1)>', subsections: [{ id: 11, heading: 'A1', text: 'Text', list: ['one', '<b>two</b>'] }] },
      { id: 2, heading: 'B', content: '', subsections: null },
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('h2')).map(h => h.textContent)).toEqual(['A', 'B']);
    expect(el.querySelector('.legal-section-text')!.textContent).toBe('x\n\ny <img src=x onerror=alert(1)>');
    expect(el.querySelector('img, b')).toBeNull();
    expect(el.querySelectorAll('li')[1].textContent).toBe('<b>two</b>');
    expect(el.querySelector('h3')!.textContent).toBe('A1');
    expect(el.querySelectorAll('li').length).toBe(2);

    fixture.componentRef.setInput('sections', []);
    fixture.detectChanges();
    expect(el.querySelector('.legal-section')).toBeNull();
  });
});
