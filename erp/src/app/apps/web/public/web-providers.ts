/**
 * @file web-providers.ts
 * @path src/app/apps/web/public/web-providers.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One import of the Angular / RxJS symbols and the public services the pages of
 *   the public web use (`import * as Web from '../web-providers'`).
 * @dependencies LocalizationService, PublicDataService, LoadingService.
 */

export { ChangeDetectorRef, ChangeDetectionStrategy, inject, Component } from '@angular/core';
export { CommonModule } from '@angular/common';
export { RouterModule, ActivatedRoute } from '@angular/router';
export { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
export { Subject, Observable, of } from 'rxjs';
export { takeUntil, finalize, delay, tap, catchError } from 'rxjs/operators';
export { LocalizationService } from '../../../shared/services/localization.service';
export { PublicDataService } from '../../../shared/services/public-data.service';
export { LoadingService } from '../../../core/services/loading.service';
export type { OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
export type { FormGroup } from '@angular/forms';
export type { HttpErrorResponse } from '@angular/common/http';