export interface ProductImage {
  [key: string]: any;
  id?: number;
  product_id?: number;
  variant_id?: number;
  image_path: string;
  alt_text: string;
  is_primary: boolean;
  sort_order: number;
  file?: File;
  url?: string;
  _delete?: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Supplier {
  id: number;
  name: string;
}

// 🌟 NOVÝ INTERFACE: Mapování zanořeného objektu cen přicházejícího z API (Laravel relace)
export interface ProductPrices {
  id?: number;
  product_id?: number;
  variant_id?: number | null;
  vat_rate: number;
  
  price_czk_with_vat: number;
  price_czk_without_vat?: number;
  
  price_eur_with_vat: number;
  price_eur_without_vat?: number;
  
  price_gbp_with_vat?: number;
  price_gbp_without_vat?: number;

  cost_price_czk?: number; // Nákupní cena CZK z DB
  cost_price_eur?: number; // Nákupní cena EUR z DB
  cost_price_gbp?: number; // Nákupní cena GBP z DB
}

export interface Variant {
  id?: number;
  variant_name: string;
  attribute_1_name?: string;
  attribute_1_value?: string;
  attribute_2_name?: string;
  attribute_2_value?: string;
  sku_variant?: string;
  vat_rate: number;
  stock_quantity: number;
  images?: ProductImage[];
  _delete?: boolean;
  
  // 🌟 Přidána relace cen i pro varianty (pokud je API vrací zanořené)
  prices?: ProductPrices;

  // Ceny pro varianty (s DPH i bez) pro všechny měny (ploché klíče)
  price_with_vat_czk?: number;
  price_without_vat_czk?: number;
  
  price_with_vat_eur?: number;
  price_without_vat_eur?: number;
  
  price_with_vat_gbp?: number;
  price_without_vat_gbp?: number;

  cost_price_czk?: number;
  cost_price_eur?: number;
}

export interface Product {
  id?: number;
  categories?: Category[];
  category_id: number;
  supplier_id?: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  sku: string;
  stock_quantity: number;
  stock_warning_level: number;
  is_active: boolean;
  is_featured: boolean;
  images?: ProductImage[];
  variants?: Variant[];
  category?: Category;
  supplier?: Supplier;
  created_at?: string;
  updated_at?: string;

  // 🌟 RELACE Z BACKENDU: Propojení s novým interfacem cen, aby TypeScript věděl o `item.prices`
  prices?: ProductPrices;

  // Prodejní ceny hlavního produktu (ploché klíče)
  price_czk?: number;
  price_eur?: number;
  price_gbp?: number;

  // Nákupní ceny hlavního produktu (ploché klíče)
  cost_price_czk?: number;
  cost_price_eur?: number;
  cost_price_gbp?: number;
}