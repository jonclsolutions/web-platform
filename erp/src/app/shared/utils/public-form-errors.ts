/**
 * @file public-form-errors.ts
 * @path src/app/shared/utils/public-form-errors.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Recognises the refusals of the anti-abuse guard of the public web forms
 * (api PublicFormGuard), so the forms can show a translated text for each of them:
 * - 422 with `captcha_required` - the captcha token was missing, expired or rejected;
 * - CaptchaUnavailableError - no token at all (script blocked / not loaded, check timed out);
 * - 429 with error_code `RECIPIENT_LIMIT` - the quota of the recipient e-mail address is used up (the per-IP
 *   limit of the route answers a plain 429).
 */

/** @description No captcha token could be obtained on submit (CaptchaComponent.nextToken()). */
export class CaptchaUnavailableError extends Error {
  constructor() {
    super('Captcha unavailable');
    this.name = 'CaptchaUnavailableError';
  }
}

/** @description Kind of a guard refusal; null for every other error. */
export type PublicFormErrorKind = 'captcha' | 'email_limit' | null;

/**
 * @description Kind of the guard refusal of an HttpErrorResponse-like error.
 * @param err Error of the submit request.
 * @returns 'captcha', 'email_limit' or null.
 */
export function publicFormErrorKey(err: any): PublicFormErrorKind {
  if (err instanceof CaptchaUnavailableError) return 'captcha';
  if (err?.status === 422 && err?.error?.captcha_required === true) return 'captcha';
  if (err?.status === 429 && err?.error?.error_code === 'RECIPIENT_LIMIT') return 'email_limit';
  return null;
}
