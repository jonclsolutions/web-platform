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

    const domElem = (this.componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    this.appRef.attachView(this.componentRef.hostView);
    document.body.appendChild(domElem);

    // 3. Předáme data do vstupů komponenty
    this.componentRef.instance.title = title;
    this.componentRef.instance.message = message;
    this.componentRef.instance.type = type;
    this.componentRef.instance.show();

    return new Promise<void>((resolve) => {
      if (!this.componentRef) return;

      // KLÍČOVÉ: Posloucháme onClose událost (vyvolá se křížkem, časovačem nebo po kliku na OK)
      // Jakmile se odpálí, vyčistíme DOM a vyřešíme Promise
      this.componentRef.instance.onClose.pipe(first()).subscribe(() => {
        this.closeDialog();
        resolve();
      });

      // Původní chování pro onOk (stále zachováno pro případ, že kód na Promise závisí)
      this.componentRef.instance.onOk.pipe(first()).subscribe(() => {
        this.closeDialog();
        resolve();
      });
    });
  }

  private closeDialog(): void {
    if (this.componentRef) {
      // Bezpečně schováme časovače v komponentě
      this.componentRef.instance.hide();
      
      // Kompletní odříznutí z Angular Application Tree a z fyzického DOMu
      this.appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
      this.componentRef = undefined;
    }
  }
}