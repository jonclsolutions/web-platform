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
    this.componentRef = createComponent(AlertDialogComponent, {
      environmentInjector: this.environmentInjector
    });

    if (!this.componentRef) {
      return Promise.resolve();
    }

    const domElem = (this.componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(this.componentRef.hostView);
    document.body.appendChild(domElem);

    // 3. Předáme data do vstupů komponenty
    this.componentRef.instance.title = title;
    this.componentRef.instance.message = message;
    this.componentRef.instance.type = type;
    this.componentRef.instance.show();

    return new Promise<void>((resolve) => {
      let isResolved = false;

      // Pomocná funkce, která garantuje, že se úklid a vyřešení Promise provede pouze jednou
      const handleClose = () => {
        if (isResolved) return;
        isResolved = true;
        this.closeDialog();
        resolve();
      };

      if (!this.componentRef) return;

      // KLÍČOVÉ: Obě události (onClose i onOk) směřují do bezpečné obalové funkce.
      // Pokud komponenta odpálí obě události naráz, handleClose druhotný pokus odfiltruje.
      this.componentRef.instance.onClose.pipe(first()).subscribe(() => {
        handleClose();
      });

      this.componentRef.instance.onOk.pipe(first()).subscribe(() => {
        handleClose();
      });
    });
  }

  private closeDialog(): void {
    // Bezpečnostní pojistka: pokud instance neexistuje, ihned skončíme a neházíme chybu
    if (!this.componentRef) {
      return;
    }

    try {
      // Bezpečně schováme časovače v komponentě
      this.componentRef.instance.hide();
      
      // Prověříme, zda hostView stále existuje a nebyl již zničen
      if (this.componentRef.hostView && !this.componentRef.hostView.destroyed) {
        this.appRef.detachView(this.componentRef.hostView);
      }
      
      // Kompletní destrukce komponenty
      this.componentRef.destroy();
    } catch (error) {
      console.warn('[AlertDialogService] Upozornění při uzavírání dialogu:', error);
    } finally {
      // V každém případě vyčistíme referenci, aby byla služba připravena na další volání open()
      this.componentRef = undefined;
    }
  }
}