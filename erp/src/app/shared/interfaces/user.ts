export interface UserRole {
  role_id: number;
  role_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UserLogin {
  user_login_id: number;
  user_email: string;
  contact_email?: string | null;       
  full_name?: string | null;          
  birth_date?: string | null;         
  personal_id_num?: string | null;
  address?: string | null;            
  bank_account?: string | null;       
  health_insurance?: string | null;   
  commission_rate?: number;           
  dpp_hours_spent?: number;           
  has_tax_declaration?: boolean;      
  phone_number?: string | null;       
  internal_note?: string | null;
  last_login_at: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  roles: UserRole[]; 
}