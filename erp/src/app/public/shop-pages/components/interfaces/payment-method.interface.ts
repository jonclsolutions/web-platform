export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  provider: string;
  price: number;  
  image_url: string | null;
  description?: string;    
  is_active?: boolean;     
}