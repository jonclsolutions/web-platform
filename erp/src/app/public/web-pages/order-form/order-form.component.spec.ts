/**
 * @file order-form.component.spec.ts
 * @path src/app/public/web-pages/order-form/order-form.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of OrderFormComponent (order via a sales-lead link): link states (no token,
 *   valid with prefill, invalid, already used), validation, the multipart submit with the lead
 *   token and the 410 "already used" / generic error handling.
 * @dependencies
 * - createPublicPageContext (get / post spies); ActivatedRoute with paramMap token.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { OrderFormComponent } from './order-form.component';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('OrderFormComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<OrderFormComponent>;
  let component: OrderFormComponent;
  const order_form = { buttons: { send: 'Order', sending: 'Sending' }, errors: { submit_error: 'Error' }, attachment_uploader: { dropzone_label: 'Drop' } };
  const lead = { id: 1, subject_name: 'ACME', contact_person: null, contact_email: 'a@acme.cz', contact_phone: null };

  /** Creates the page for the token (null = no token in the URL); `leadReply` answers the prefill request. */
  function create(token: string | null, leadReply: any = of(lead)): void {
    ctx = createPublicPageContext({ translations: { order_form } });
    ctx.publicData.get.and.returnValue(leadReply);
    TestBed.configureTestingModule({
      imports: [OrderFormComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}) } } }]
    });
    fixture = TestBed.createComponent(OrderFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Link states: no token; valid → prefill (person → company name fallback);
   *   410 → used; other error → invalid.
   * @input token null; 'abc' with lead; 410; 404.
   * @output 'no-token' (no request); 'valid' + client_name 'ACME', email; 'used'; 'invalid'.
   */
  it('resolves the order link', () => {
    create(null);
    expect(component.linkState).toBe('no-token');
    expect(ctx.publicData.get).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    create('abc');
    expect(ctx.publicData.get).toHaveBeenCalledWith('public/sales-leads/abc');
    expect(component.linkState).toBe('valid');
    expect(component.orderForm.value.client_name).toBe('ACME');
    expect(component.orderForm.value.client_email).toBe('a@acme.cz');
    expect(component.orderForm.value.client_phone).toBe('');

    TestBed.resetTestingModule();
    create('abc', of({ ...lead, contact_person: 'Eva', subject_name: null, contact_email: null, contact_phone: '777' }));
    expect(component.orderForm.value.client_name).toBe('Eva');
    expect(component.orderForm.value.client_phone).toBe('777');

    TestBed.resetTestingModule();
    create('abc', of({ ...lead, contact_person: null, subject_name: null }));
    expect(component.orderForm.value.client_name).toBe('');

    TestBed.resetTestingModule();
    create('used', throwError(() => ({ status: 410 })));
    expect(component.linkState).toBe('used');
    TestBed.resetTestingModule();
    create('bad', throwError(() => ({ status: 404 })));
    expect(component.linkState).toBe('invalid');
  });

  /**
   * @description Submit: invalid form ignored; valid order posted with all fields, the lead token
   *   and attachments; success state; 410 → link used; other errors → translated message.
   * @input Empty form; filled form + 1 file; 410; 500.
   * @output No post; post sales_orders with client_name / lead_token / attachments[]; isSubmitted; 'used'; 'Error'.
   */
  it('submits the order', () => {
    create('abc');
    component.orderForm.patchValue({ order_description: '' });
    component.onSubmit();
    expect(ctx.publicData.post).not.toHaveBeenCalled();
    expect(component.btnText).toBe('Order');
    expect(component.attachmentUploaderTexts).toEqual(jasmine.objectContaining({ dropzoneLabel: 'Drop' }));

    component.orderForm.patchValue({ ico: '123', order_description: 'Website', dataProcessingAgreement: true, tosAgreement: true });
    component.onFilesChanged([new File(['x'], 'brief.pdf')]);
    component.onSubmit();
    const [endpoint, fd] = ctx.publicData.post.calls.mostRecent().args as [string, FormData];
    expect(endpoint).toBe('sales_orders');
    expect([fd.get('client_name'), fd.get('ico'), fd.get('lead_token')]).toEqual(['ACME', '123', 'abc']);
    expect((fd.get('attachments[]') as File).name).toBe('brief.pdf');
    expect(component.isSubmitted).toBeTrue();
    expect(component.isLoading).toBeFalse();

    spyOn(console, 'error');
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 410 })));
    component.onSubmit();
    expect(component.linkState).toBe('used');
    expect(component.errorMessage).toBeNull();
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 500 })));
    component.onSubmit();
    expect(component.errorMessage).toBe('Error');
  });

  /**
   * @description Texts: '...' before translations, "sending" while loading, {} without uploader texts;
   *   the generic English fallback when the translation has no error text.
   * @input t null; isLoading true; t without attachment_uploader / errors + 500.
   * @output '...'; 'Sending'; {}; 'Submission error.'.
   */
  it('falls back for missing texts', () => {
    create('abc');
    component.isLoading = true;
    expect(component.btnText).toBe('Sending');
    component.t = null;
    expect(component.btnText).toBe('...');
    expect(component.attachmentUploaderTexts).toEqual({});

    spyOn(console, 'error');
    component.orderForm.patchValue({ order_description: 'X', dataProcessingAgreement: true, tosAgreement: true });
    ctx.publicData.post.and.returnValue(throwError(() => ({ status: 500 })));
    component.onSubmit();
    expect(component.errorMessage).toBe('Submission error.');
  });
});
