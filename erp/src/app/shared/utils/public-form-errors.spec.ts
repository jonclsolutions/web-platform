/**
 * @file public-form-errors.spec.ts
 * @path src/app/shared/utils/public-form-errors.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of publicFormErrorKey(): the refusals of PublicFormGuard are recognised,
 *   every other error (validation, per-IP limit, server error) is not.
 */

import { CaptchaUnavailableError, publicFormErrorKey } from './public-form-errors';

describe('publicFormErrorKey', () => {
  /**
   * @description Guard refusals by status AND marker; everything else null.
   * @input 422 captcha_required; CaptchaUnavailableError; 429 error_code RECIPIENT_LIMIT; 429 plain; 422 errors; 500; undefined.
   * @output 'captcha' ×2; 'email_limit'; null ×4.
   */
  it('recognises the guard refusals only', () => {
    expect(publicFormErrorKey({ status: 422, error: { captcha_required: true } })).toBe('captcha');
    expect(publicFormErrorKey(new CaptchaUnavailableError())).toBe('captcha');
    expect(new CaptchaUnavailableError().name).toBe('CaptchaUnavailableError');
    expect(publicFormErrorKey({ status: 429, error: { error_code: 'RECIPIENT_LIMIT', retry_after: 60 } })).toBe('email_limit');
    expect(publicFormErrorKey({ status: 429, error: { message: 'Too many requests.' } })).toBeNull();
    expect(publicFormErrorKey({ status: 422, error: { errors: { email: ['x'] } } })).toBeNull();
    expect(publicFormErrorKey({ status: 500 })).toBeNull();
    expect(publicFormErrorKey(undefined)).toBeNull();
  });
});
