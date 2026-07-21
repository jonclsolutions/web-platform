/**
 * @file test-utils.ts
 * @path src/testing/test-utils.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description
 * @dependencies
 */

import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
export function getRouterProviders() {
  return [{
    provide: ActivatedRoute,
    useValue: {
      snapshot: { paramMap: { get: () => '1' } },
      params: of({ id: '1' }),
      queryParams: of({})
    }
  }];
}