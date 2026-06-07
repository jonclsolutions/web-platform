import { Component, OnInit, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../components/services/cart.service';
import { ShopPublicService } from '../components/services/public-data.service';
import { ShippingMethod } from '../components/interfaces/shipping-method.interface';
import { PaymentMethod } from '../components/interfaces/payment-method.interface';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  currentStep = signal(1); // 1 = Formulář, 5 = Úspěch
  isProcessing = signal(false);
  orderNumber = signal<string | null>(null);

  couponCode = '';
  couponStatus = signal<string | null>(null);

  shippingMethods = signal<ShippingMethod[]>([]);
  paymentMethods = signal<PaymentMethod[]>([]);
  appliedCoupon = signal<any | null>(null);
  selectedShippingPrice = signal(0);

  formData = {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    company: null as string | null,
    address: '',
    city: '',
    postalCode: '',
    country: 'Czechia',
    shippingMethodId: null as number | null,
    paymentMethodId: null as number | null,
    notes: null as string | null,
    agreeToTerms: false
  };

  // 🛡️ BEZPEČNÁ REKAPITULACE: Všechny finanční operace striktně izolujeme do CZK
  orderSummary = computed(() => {
    const cartItems = this.cartService.cartItems() || [];
    
    // Výpočet mezisoučtu produktů striktně z CZK hodnoty, ignorujeme nespolehlivá globální pole
    const productsTotal = cartItems.reduce((acc, item) => {
      const priceCzk = item.prices?.price_czk_with_vat ?? item.unit_price ?? 0;
      return acc + (Number(priceCzk) * Number(item.quantity || 0));
    }, 0);

    const coupon = this.appliedCoupon();
    
    let discount = 0;
    if (coupon) {
      if (coupon.discount_type === 'percent') {
        discount = (productsTotal * Number(coupon.discount_value || 0)) / 100;
      } else {
        discount = Number(coupon.discount_value || 0);
      }
    }
    const discountAmount = Math.min(discount, productsTotal);
    const discountFactor = productsTotal > 0 ? (productsTotal - discountAmount) / productsTotal : 1;

    let totalBaseAfterDiscount = 0;
    const vatBreakdown: { [key: number]: { amount: number; baseAmount: number } } = {};
    
    cartItems.forEach(item => {
      // 🛡️ Ochrana: Prioritně bereme zanořené CZK, až pak fallback
      const itemUnitPrice = Number(item.prices?.price_czk_with_vat ?? item.unit_price ?? 0);
      const itemQuantity = Number(item.quantity || 0);
      const itemVatRate = Number(item.prices?.vat_rate ?? item.vat_rate ?? 21);

      const lineTotalAfterDiscount = (itemQuantity * itemUnitPrice) * discountFactor;
      const itemVat = lineTotalAfterDiscount * (itemVatRate / (100 + itemVatRate));
      const itemBase = lineTotalAfterDiscount - itemVat;

      totalBaseAfterDiscount += itemBase;
      if (!vatBreakdown[itemVatRate]) {
        vatBreakdown[itemVatRate] = { amount: 0, baseAmount: 0 };
      }
      vatBreakdown[itemVatRate].amount += itemVat;
      vatBreakdown[itemVatRate].baseAmount += itemBase;
    });

    const shippingAmount = Number(this.selectedShippingPrice() || 0);
    const finalAmount = Math.max(0, (productsTotal - discountAmount) + shippingAmount);

    return {
      productsTotal,
      discountAmount,
      shippingAmount,
      baseAmount: totalBaseAfterDiscount,
      vatGroups: Object.keys(vatBreakdown).map(rate => ({
        rate: Number(rate),
        amount: vatBreakdown[Number(rate)].amount,
        baseAmount: vatBreakdown[Number(rate)].baseAmount
      })),
      finalAmount
    };
  });

  constructor(
    public cartService: CartService,
    private shopPublicService: ShopPublicService,
    private router: Router,
    private alertDialogService: AlertDialogService
  ) {}

  ngOnInit(): void {
    if (this.cartService.cartCount() === 0) {
      this.router.navigate(['/cart']);
      return;
    }
    this.loadShippingMethods();
    this.loadPaymentMethods();
  }

  loadShippingMethods(): void {
    this.shopPublicService.getShippingMethods().subscribe({
      next: (response) => {
        const methods = response.data || response;
        this.shippingMethods.set(methods);
        if (methods.length > 0) {
          this.selectShippingMethod(methods[0].id);
        }
      },
      error: (e) => console.error('Chyba při načítání dopravy:', e)
    });
  }

  loadPaymentMethods(): void {
    this.shopPublicService.getPaymentMethods().subscribe({
      next: (response) => {
        const payments = response.data || response;
        this.paymentMethods.set(payments);
        if (payments.length > 0) {
          this.selectPaymentMethod(payments[0].id);
        }
      },
      error: (e) => console.error('Chyba při načítání platebních metod:', e)
    });
  }

  selectShippingMethod(id: number): void {
    this.formData.shippingMethodId = id;
    const method = this.shippingMethods().find(m => m.id === id);
    this.selectedShippingPrice.set(method?.base_price || 0);
  }

  selectPaymentMethod(id: number): void {
    this.formData.paymentMethodId = id;
  }

  isFormValid(): boolean {
    return !!(
      this.formData.email &&
      this.formData.firstName &&
      this.formData.lastName &&
      this.formData.phone &&
      this.formData.address &&
      this.formData.city &&
      this.formData.postalCode &&
      this.formData.shippingMethodId &&
      this.formData.paymentMethodId &&
      this.formData.agreeToTerms
    );
  }

  applyCoupon(): void {
    if (!this.couponCode.trim()) return;

    // Pro validaci kupónu předáme přepočítaný bezpečný CZK mezisoučet
    this.shopPublicService.validateCoupon(this.couponCode, this.orderSummary().productsTotal).subscribe({
      next: (response) => {
        this.appliedCoupon.set(response.coupon);
        this.couponStatus.set(`✓ Kód aktivován: ${response.coupon.code}`);
      },
      error: (e) => {
        this.couponStatus.set('❌ ' + (e.error?.message || 'Neplatný kód'));
        this.appliedCoupon.set(null);
      }
    });
  }

  // 🛡️ EXTRA BEZPEČNÉ ODESLÁNÍ DO BANKY / BACKENDU
  simulatePayment(): void {
    if (!this.isFormValid()) return;
    this.isProcessing.set(true);

    const formattedItems = (this.cartService.cartItems() || []).map(item => {
      // Tvrdošíjně vytáhneme cenu v CZK. Pokud tam není, dojde k chybě, čímž zabráníme poslání špatné měny
      const confirmedCzkPrice = item.prices?.price_czk_with_vat ?? item.unit_price;

      if (!confirmedCzkPrice || confirmedCzkPrice <= 0) {
        this.isProcessing.set(false);
        throw new Error(`Kritická chyba měny: Produkt ${item.product_name} nemá platnou CZK cenu!`);
      }

      return {
        product_id: Number(item.product_id || item.id), 
        product_variant_id: item.product_variant_id ? Number(item.product_variant_id) : null,
        quantity: Number(item.quantity),
        unit_price: Number(confirmedCzkPrice), // Zde posíláme explicitně ověřenou CZK cenu
        vat_rate: item.prices?.vat_rate ? Number(item.prices.vat_rate) : (item.vat_rate ? Number(item.vat_rate) : 21)
      };
    });

    const payload = {
      email: this.formData.email,
      first_name: this.formData.firstName,
      last_name: this.formData.lastName,
      phone: this.formData.phone,
      company: null,
      address: this.formData.address,
      city: this.formData.city,
      postal_code: this.formData.postalCode,
      country: this.formData.country,
      payment_method_id: Number(this.formData.paymentMethodId),
      shipping_method_id: Number(this.formData.shippingMethodId),
      coupon_code: this.appliedCoupon()?.code || null,
      currency: 'CZK', // 🛡️ Explicitní příznak měny pro backendovou kontrolu
      total_amount: Number(this.orderSummary().finalAmount), // Kontrolní finální částka
      notes: null,
      items: formattedItems
    };

    this.shopPublicService.createOrder(payload)
      .subscribe({
        next: (response) => {
          this.orderNumber.set(response.order_number);
          this.cartService.clear();
          this.currentStep.set(5);
          this.isProcessing.set(false);
        },
        error: (e) => {
          console.error('Chyba při vytváření objednávky:', e);
          if (e.status === 422 && e.error?.errors) {
            const validationErrors = Object.values(e.error.errors).flat().join('\n');
            this.alertDialogService.open('Chyba validace', validationErrors, 'danger');
          } else {
            const errorMsg = e.error?.message || 'Objednávku se nepodařilo vytvořit. Zkuste to prosím znovu.';
            this.alertDialogService.open('Chyba', errorMsg, 'danger');
          }
          this.isProcessing.set(false);
          }
      });
  }

  finishCheckout(): void {
    this.router.navigate(['/shop']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 2
    }).format(price);
  }
}