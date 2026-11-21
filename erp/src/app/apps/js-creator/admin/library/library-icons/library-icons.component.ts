/**
 * @file library-icons.component.ts
 * @path src/app/apps/js-creator/admin/library/library-icons/library-icons.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Tab "Icons" of the library: the icon set of the application (Lucide, ISC) with a
 *   search by name - the icons a template can use as an element.
 * @dependencies IconSetService, CreatorIconComponent, AdminLocalizationService (section
 *   `js-creator-library`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { IconSetService } from '../../shared/icon-set.service';
import { IconNode } from '../../shared/js-creator.models';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';

/** One icon of the grid. */
interface IconEntry {
  name: string;
  nodes: IconNode[];
}

@Component({
  selector: 'app-library-icons',
  standalone: true,
  imports: [FormsModule, CreatorIconComponent],
  templateUrl: './library-icons.component.html',
  styleUrls: ['../../shared-styles/workspace.css', './library-icons.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryIconsComponent implements OnInit, OnDestroy {
  private readonly iconSet = inject(IconSetService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Every icon of the set. */
  icons: IconEntry[] = [];
  /** Search in the names. */
  search = '';
  /** Source and licence of the set. */
  source = '';

  private sub?: Subscription;

  /** @description Loads the set. */
  ngOnInit(): void {
    this.sub = this.iconSet.iconSet().subscribe(set => {
      this.icons = Object.entries(set.icons).map(([name, nodes]) => ({ name, nodes }));
      this.source = set.source ? `${set.source} · ${set.license}` : '';
      this.cd.markForCheck();
    });
  }

  /** @description Ends the subscription. */
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /**
   * @description Text of the section.
   * @param key Key in `js-creator-library`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-library.${key}`);
  }

  /** @description Icons whose name contains the search. */
  get shown(): IconEntry[] {
    const needle = this.search.trim().toLowerCase();
    return needle ? this.icons.filter(icon => icon.name.includes(needle)) : this.icons;
  }
}
