export interface Order {
  id?: number;
  order_number?: string;
  customer_id?: number;
  customer?: Customer;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  company?: string | null;
  status: string;
  status_label?: string;
  payment_status: string;
  payment_status_label?: string;
  total_amount: number;
  shipping_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  currency?: string;
  coupon_id?: number | null;
  coupon?: Coupon;
  payment_method_id: number;
  payment_method?: PaymentMethod;
  shipping_method_id: number;
  shipping_method?: ShippingMethod;
  coupon_code?: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  notes?: string | null;
  items: OrderItem[];
  items_count?: number;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  product_name: string;
  product_variant_id?: number;
  variant_name?: string;
  display_name?: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  total_price: number;
  created_at?: string;
  _delete?: boolean;
}

export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  is_active: boolean;
  total_spent: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  variant_name: string;
  product_name?: string;
  attribute_1_name?: string;
  attribute_1_value?: string;
  attribute_2_name?: string;
  attribute_2_value?: string;
  sku_variant?: string;
  price_with_vat: number;
  price_without_vat: number;
  vat_rate: number;
  stock_quantity: number;
}

export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
}

export interface ShippingMethod {
  id: number;
  code: string;
  name: string;
  description?: string;
  base_price: number;
  allows_cod: boolean;
  cod_price: number;
  is_active: boolean;
}

export interface Coupon {
  id: number;
  code: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  max_usage?: number;
  usage_count: number;
  min_order_amount?: number;
  applies_to: string;
  is_active: boolean;
  valid_from?: string | Date; 
  valid_until?: string | Date;
}