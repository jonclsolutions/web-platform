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
 * @refactor-note (2026-10-21) Dědí `BasePublicComponent` (`translationModule = 'shop'`, sekce
 *   `checkout`). Validační hlášky (`errors.*`), kupóny a alerty (`alerts.*`) jdou z překladů;
 *   odstraněny natvrdo psané české fallbacky. Hláška ze serveru (`e.error.message`) má dál přednost.
 * @bugfix-note (2026-10-23) Prices were formatted with cs-CZ in every language (open finding #44) -
 *   BasePublicComponent.formatEur() now; an unpriced cart line shows a translated alert instead of an
 *   uncaught Czech exception.
 * @bugfix-note (2026-10-23) Open finding #53: order / coupon errors showed the English API messages
 *   on the Czech shop - translated texts by status now (stock / rejected order / too many requests).
 * @refactor-note (2026-10-24) Open finding #6 (one API envelope `{data, meta?}`): shipping /
 *  payment methods are the payload lists of ShopPublicService.
 */

import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../components/services/cart.service';
import { ShopPublicService } from '../components/services/public-data.service';
import { ShippingMethod } from '../components/interfaces/shipping-method.interface';
import { PaymentMethod } from '../components/interfaces/payment-method.interface';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { BasePublicComponent } from '../../base-public.component';

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
  styleUrls: ['../shared-styles/theme.css', './checkout.component.css']
})
export class CheckoutComponent extends BasePublicComponent implements OnInit {
  protected readonly translationKey = 'checkout';
  protected override readonly translationModule = 'shop';

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
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
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
        const methods = response ?? [];
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
        const payments = response ?? [];
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
          this.errors['email'] = this.t?.errors?.email_required;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
          this.errors['email'] = this.t?.errors?.email_invalid;
        } else {
          this.errors['email'] = '';
        }
        break;

      case 'phone':
        if (!this.formData.phone) {
          this.errors['phone'] = this.t?.errors?.phone_required;
        } else {
          this.errors['phone'] = '';
        }
        break;

      case 'firstName':
        if (!this.formData.firstName) {
          this.errors['firstName'] = this.t?.errors?.first_name_required;
        } else if (/\d/.test(this.formData.firstName)) {
          this.errors['firstName'] = this.t?.errors?.first_name_digits;
        } else {
          this.errors['firstName'] = '';
        }
        break;

      case 'lastName':
        if (!this.formData.lastName) {
          this.errors['lastName'] = this.t?.errors?.last_name_required;
        } else if (/\d/.test(this.formData.lastName)) {
          this.errors['lastName'] = this.t?.errors?.last_name_digits;
        } else {
          this.errors['lastName'] = '';
        }
        break;

      case 'address':
        if (!this.formData.address) {
          this.errors['address'] = this.t?.errors?.address_required;
        } else if (this.formData.address.length > 255) {
          this.errors['address'] = this.t?.errors?.address_too_long;
        } else {
          this.errors['address'] = '';
        }
        break;

      case 'city':
        if (!this.formData.city) {
          this.errors['city'] = this.t?.errors?.city_required;
        } else if (this.formData.city.length > 100) {
          this.errors['city'] = this.t?.errors?.city_too_long;
        } else {
          this.errors['city'] = '';
        }
        break;

      case 'postalCode':
        if (!this.formData.postalCode) {
          this.errors['postalCode'] = this.t?.errors?.postal_code_required;
        } else if (this.formData.postalCode.length > 10) {
          this.errors['postalCode'] = this.t?.errors?.postal_code_too_long;
        } else if (!/^\d{3}\s?\d{2}$/.test(this.formData.postalCode.trim())) {
          this.errors['postalCode'] = this.t?.errors?.postal_code_invalid;
        } else {
          this.errors['postalCode'] = '';
        }
        break;

      case 'shippingMethodId':
        this.errors['shippingMethodId'] = !this.formData.shippingMethodId ? this.t?.errors?.shipping_required : '';
        break;

      case 'paymentMethodId':
        this.errors['paymentMethodId'] = !this.formData.paymentMethodId ? this.t?.errors?.payment_required : '';
        break;

      case 'agreeToTerms':
        this.errors['agreeToTerms'] = !this.formData.agreeToTerms ? this.t?.errors?.terms_required : '';
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
        this.couponStatus.set(this.t?.coupon_applied?.replace('{code}', response.coupon.code));
      },
      error: (e) => {
        // Translated reason only - the API text is English (finding #53).
        this.couponStatus.set(this.t?.coupon_error?.replace('{message}', (e?.status === 429 ? this.t?.coupon_too_many : this.t?.coupon_invalid) ?? ''));
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
      this.alertDialogService.open(this.t?.alerts?.form_incomplete_title, this.t?.alerts?.form_incomplete_message, 'warning');
      return;
    }
    
    // A cart line without a valid EUR price cannot be ordered: translated alert instead of the
    // former uncaught Czech `throw` (finding #44). The API prices the order itself anyway.
    const items = this.cartService.cartItems() || [];
    const unpriced = items.find(item => !((item.prices?.price_eur_with_vat ?? item.unit_price) > 0));
    if (unpriced) {
      this.alertDialogService.open(this.t?.alerts?.error_title, (this.t?.alerts?.price_invalid_message ?? '').replace('{product}', unpriced.product_name), 'danger');
      return;
    }

    this.isProcessing.set(true);

    const formattedItems = items.map(item => {
      const confirmedEurPrice = item.prices?.price_eur_with_vat ?? item.unit_price;

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
              // Translated texts instead of the English API messages (finding #53).
              if (key.startsWith('items.')) {
                this.alertDialogService.open(this.t?.alerts?.stock_title, this.t?.alerts?.stock_message, 'danger');
              } else {
                const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                if (this.errors.hasOwnProperty(camelKey)) {
                  this.errors[camelKey] = this.t?.errors?.invalid_value;
                }
              }
            });
          } else {
            const errorMsg = e?.status === 422 ? this.t?.alerts?.order_rejected_message
              : e?.status === 429 ? this.t?.alerts?.too_many_requests
              : this.t?.alerts?.order_failed_message;
            this.alertDialogService.open(this.t?.alerts?.error_title, errorMsg, 'danger');
          }
          this.isProcessing.set(false);
        }
      });
  }

  finishCheckout(): void {
    this.router.navigate(['/shop']);
  }

  formatPrice(price: number): string {
    return this.formatEur(price);
  }
}