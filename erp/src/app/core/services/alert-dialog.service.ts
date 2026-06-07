import { Injectable, ComponentRef, ApplicationRef, EnvironmentInjector, createComponent, EmbeddedViewRef } from '@angular/core';
import { AlertDialogComponent, AlertType } from '../../admin/components/alert-dialog/alert-dialog.component';
import { first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AlertDialogService {
  private componentRef?: ComponentRef<AlertDialogComponent>;

  constructor(
    private environmentInjector: EnvironmentInjector,
    private appRef: ApplicationRef
  ) {}

  open(title: string, message: string, type: AlertType = 'info'): Promise<void> {
    // 1. Pro jistotu zavřeme jakýkoliv předchozí zobrazený toast
    this.closeDialog();

    // 2. Dynamicky vytvoříme instanci komponenty toastu
    const ref = createComponent(AlertDialogComponent, {
      environmentInjector: this.environmentInjector
    });

    this.componentRef = ref;

    if (!ref) {
      return Promise.resolve();
    }

    const domElem = (ref.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(domElem);

    // 3. Předáme data do vstupů komponenty
    ref.instance.title = title;
    ref.instance.message = message;
    ref.instance.type = type;
    ref.instance.show();

    return new Promise<void>((resolve) => {
      let isResolved = false;

      // Pomocná funkce, která garantuje, že se úklid a vyřešení Promise provede pouze jednou
      const handleClose = () => {
        if (isResolved) return;
        isResolved = true;
        this.closeDialog();
        resolve();
      };

      // KLÍČOVÉ: Obě události (onClose i onOk) směřují do bezpečné obalové funkce.
      ref.instance.onClose.pipe(first()).subscribe(() => {
        handleClose();
      });

      ref.instance.onOk.pipe(first()).subscribe(() => {
        handleClose();
      });
    });
  }

  private closeDialog(): void {
    // Bezpečnostní pojistka: pokud instance neexistuje, ihned skončíme
    if (!this.componentRef) {
      return;
    }

    // Uložíme si referenci do lokální proměnné, aby nám ji asynchronní volání "nepodtrhlo" nastavením na undefined
    const refToDestroy = this.componentRef;
    // Okamžitě vyčistíme globální referenci, aby případná další asynchronní volání closeDialog() skončila hned na první pojistce nahoře
    this.componentRef = undefined;

    try {
      // Bezpečně schováme časovače v komponentě
      if (refToDestroy.instance) {
        refToDestroy.instance.hide();
      }
      
      // Prověříme, zda hostView stále existuje a nebyl již zničen
      if (refToDestroy.hostView && !refToDestroy.hostView.destroyed) {
        this.appRef.detachView(refToDestroy.hostView);
      }
      
      // Kompletní destrukce komponenty
      refToDestroy.destroy();
    } catch (error) {
      console.warn('[AlertDialogService] Upozornění při uzavírání dialogu:', error);
    }
  }
}