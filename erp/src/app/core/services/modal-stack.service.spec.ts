/**
 * @file modal-stack.service.spec.ts
 * @path src/app/core/services/modal-stack.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ModalStackService - the order of the open modals.
 * @dependencies none
 */

import { ModalStackService } from './modal-stack.service';

describe('ModalStackService', () => {
  /**
   * @description The last opened modal is on top; closing it (or one below) keeps the order;
   *   opening an already open modal moves it to the top.
   * @input open a, open b; close b; open b, close a; open a twice; close c (never opened).
   * @output top b, then a; b; a (once in the stack - closing it leaves nothing); unknown close ignored.
   */
  it('keeps the last opened modal on top', () => {
    const stack = new ModalStackService();
    const a = {}, b = {}, c = {};
    expect(stack.isTop(a)).toBeFalse();

    stack.open(a);
    stack.open(b);
    expect([stack.isTop(a), stack.isTop(b)]).toEqual([false, true]);

    stack.close(b);
    expect(stack.isTop(a)).toBeTrue();

    stack.open(b);
    stack.close(a);
    expect(stack.isTop(b)).toBeTrue();

    stack.open(a);
    stack.open(a);
    stack.close(c);
    expect(stack.isTop(a)).toBeTrue();
    stack.close(a);
    expect([stack.isTop(a), stack.isTop(b)]).toEqual([false, true]);
  });
});
