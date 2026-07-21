/**
 * @file router-stub.ts
 * @path src/testing/router-stub.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description
 * @dependencies
 */

import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

export const PROVIDE_ACTIVATED_ROUTE = {
  provide: ActivatedRoute,
  useValue: {
    snapshot: { paramMap: { get: () => '1' } },
    params: of({ id: '1' }),
    queryParams: of({})
  }
};