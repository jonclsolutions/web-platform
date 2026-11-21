export interface ShippingMethod {
  id: number;
  name: string;
  base_price: number;
  description: string;
  /** ISO codes of the countries the method delivers to (empty / missing = everywhere, an old method). */
  countries?: string[];
}