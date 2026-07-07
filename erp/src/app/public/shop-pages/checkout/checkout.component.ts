/**
 * @file checkout.component.ts
 * @path src/app/public/shop-pages/checkout/checkout.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the multi-step checkout process including form validation, coupon application, and final order submission.
 * @dependencies
 * - CartService: Provides reactive access to cart items and clearing operations.
 * - ShopPublicService: Handles shipping/payment methods, coupon validation, and order submission.
 * - AlertDialogService: Provides user feedback for submission or validation errors.
 */

import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../components/services/cart.service';
import { ShopPublicService } from '../components/services/public-data.service';
import { ShippingMethod } from '../components/interfaces/shipping-method.interface';
import { PaymentMethod } from '../components/interfaces/payment-method.interface';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';

/**
 * @description Component for handling the e-shop checkout flow.
 * @usage Orchestrates form entry, data validation, pricing summaries, and final API order creation.
 * @note Implements strict financial isolation using EUR as the base currency for all calculations and order submissions.
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  currentStep = signal(1); // 1 = Form entry, 5 = Success
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

  errors: { [key: string]: string } = {
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    postalCode: '',
    shippingMethodId: '',
    paymentMethodId: '',
    agreeToTerms: ''
  };

  formSubmitted = false;

  /**
   * @description Computes the financial summary of the cart, including VAT breakdowns and discounts.
   * @note Ensures all calculations strictly follow EUR pricing rules derived from the cart service.
   * @returns An object containing totals, VAT breakdowns, and the final payment amount.
   */
  orderSummary = computed(() => {
    const cartItems = this.cartService.cartItems() || [];
    
    const productsTotal = cartItems.reduce((acc, item) => {
      const priceEur = item.prices?.price_eur_with_vat ?? item.unit_price ?? 0;
      return acc + (Number(priceEur) * Number(item.quantity || 0));
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
      const itemUnitPrice = Number(item.prices?.price_eur_with_vat ?? item.unit_price ?? 0);
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

  /**
   * @description Fetches available shipping options and selects the default.
   */
  loadShippingMethods(): void {
    this.shopPublicService.getShippingMethods().subscribe({
      next: (response) => {
        const methods = response.data || response;
        this.shippingMethods.set(methods);
        if (methods.length > 0) {
          this.selectShippingMethod(methods[0].id);
        }
      },
      error: (e) => console.error('Error loading shipping methods:', e)
    });
  }

  /**
   * @description Fetches available payment options and selects the default.
   */
  loadPaymentMethods(): void {
    this.shopPublicService.getPaymentMethods().subscribe({
      next: (response) => {
        const payments = response.data || response;
        this.paymentMethods.set(payments);
        if (payments.length > 0) {
          this.selectPaymentMethod(payments[0].id);
        }
      },
      error: (e) => console.error('Error loading payment methods:', e)
    });
  }

  /**
   * @description Updates selected shipping method and updates calculation state.
   * @param id The method identifier.
   */
  selectShippingMethod(id: number): void {
    this.formData.shippingMethodId = id;
    const method = this.shippingMethods().find(m => m.id === id);
    this.selectedShippingPrice.set(method?.base_price || 0);
    this.validateField('shippingMethodId');
  }

  /**
   * @description Updates selected payment method.
   * @param id The method identifier.
   */
  selectPaymentMethod(id: number): void {
    this.formData.paymentMethodId = id;
    this.validateField('paymentMethodId');
  }

  /**
   * @description Validates individual form fields for correct formatting and mandatory presence.
   * @param field The field key to validate.
   */
  validateField(field: string): void {
    switch (field) {
      case 'email':
        if (!this.formData.email) {
          this.errors['email'] = 'E-mailová adresa je povinná.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
          this.errors['email'] = 'Zadejte platný formát e-mailové adresy.';
        } else {
          this.errors['email'] = '';
        }
        break;

      case 'phone':
        if (!this.formData.phone) {
          this.errors['phone'] = 'Telefonní číslo je povinné.';
        } else {
          this.errors['phone'] = '';
        }
        break;

      case 'firstName':
        if (!this.formData.firstName) {
          this.errors['firstName'] = 'Jméno je povinné.';
        } else if (/\d/.test(this.formData.firstName)) {
          this.errors['firstName'] = 'Jméno nesmí obsahovat číslice.';
        } else {
          this.errors['firstName'] = '';
        }
        break;

      case 'lastName':
        if (!this.formData.lastName) {
          this.errors['lastName'] = 'Příjmení je povinné.';
        } else if (/\d/.test(this.formData.lastName)) {
          this.errors['lastName'] = 'Příjmení nesmí obsahovat číslice.';
        } else {
          this.errors['lastName'] = '';
        }
        break;

      case 'address':
        if (!this.formData.address) {
          this.errors['address'] = 'Ulice a číslo popisné jsou povinné.';
        } else if (this.formData.address.length > 255) {
          this.errors['address'] = 'Adresa může mít maximálně 255 znaků.';
        } else {
          this.errors['address'] = '';
        }
        break;

      case 'city':
        if (!this.formData.city) {
          this.errors['city'] = 'Město je povinné.';
        } else if (this.formData.city.length > 100) {
          this.errors['city'] = 'Název města může mít maximálně 100 znaků.';
        } else {
          this.errors['city'] = '';
        }
        break;

      case 'postalCode':
        if (!this.formData.postalCode) {
          this.errors['postalCode'] = 'PSČ je povinné.';
        } else if (this.formData.postalCode.length > 10) {
          this.errors['postalCode'] = 'PSČ může mít maximálně 10 znaků.';
        } else if (!/^\d{3}\s?\d{2}$/.test(this.formData.postalCode.trim())) {
          this.errors['postalCode'] = 'Zadejte platné PSČ (např. 110 00 nebo 11000).';
        } else {
          this.errors['postalCode'] = '';
        }
        break;

      case 'shippingMethodId':
        this.errors['shippingMethodId'] = !this.formData.shippingMethodId ? 'Vyberte způsob dopravy.' : '';
        break;

      case 'paymentMethodId':
        this.errors['paymentMethodId'] = !this.formData.paymentMethodId ? 'Vyberte způsob platby.' : '';
        break;

      case 'agreeToTerms':
        this.errors['agreeToTerms'] = !this.formData.agreeToTerms ? 'Pro dokončení musíte souhlasit s obchodními podmínkami.' : '';
        break;
    }
  }

  validateAllFields(): boolean {
    Object.keys(this.errors).forEach(field => this.validateField(field));
    return !Object.values(this.errors).some(errorMsg => errorMsg !== '');
  }

  isFormValid(): boolean {
    return !!(
      this.formData.email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email) &&
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

  /**
   * @description Validates the coupon code via API and updates the applied coupon state.
   */
  applyCoupon(): void {
    if (!this.couponCode.trim()) return;

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

  /**
   * @description Submits order data to the backend API.
   * @note Performs final sanity checks on pricing before transmission to ensure data integrity.
   */
  simulatePayment(): void {
    this.formSubmitted = true;
    
    if (!this.validateAllFields()) {
      this.alertDialogService.open('Formulář je nekompletní', 'Zkontrolujte prosím červeně označená pole.', 'warning');
      return;
    }
    
    this.isProcessing.set(true);

    const formattedItems = (this.cartService.cartItems() || []).map(item => {
      const confirmedEurPrice = item.prices?.price_eur_with_vat ?? item.unit_price;

      if (!confirmedEurPrice || confirmedEurPrice <= 0) {
        this.isProcessing.set(false);
        throw new Error(`Kritická chyba měny: Produkt ${item.product_name} nemá platnou EUR cenu!`);
      }

      return {
        product_id: Number(item.product_id || item.id), 
        product_variant_id: item.product_variant_id ? Number(item.product_variant_id) : null,
        quantity: Number(item.quantity),
        unit_price: Number(confirmedEurPrice),
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
      currency: 'EUR', 
      total_amount: Number(this.orderSummary().finalAmount), 
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
          this.formSubmitted = false;
        },
        error: (e) => {
          console.error('Chyba při vytváření objednávky:', e);
          if (e.status === 422 && e.error?.errors) {
            const backendErrors = e.error.errors;
            Object.keys(backendErrors).forEach(key => {
              if (key.startsWith('items.')) {
                this.alertDialogService.open('Skladová zásoba', backendErrors[key][0], 'danger');
              } else {
                const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                if (this.errors.hasOwnProperty(camelKey)) {
                  this.errors[camelKey] = backendErrors[key][0];
                }
              }
            });
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
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }
}