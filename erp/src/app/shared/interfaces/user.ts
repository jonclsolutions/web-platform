/**
 * @file user.ts
 * @path src/app/shared/interfaces/user.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Shared TypeScript interfaces for user/role data across the admin app.
 * @refactor-note (2026-08-16) Přidána pole enable_2fa a two_fa_forced_by_admin (backlog
 * "captcha + 2FA na mail") a nový LoginTwoFactorChallenge typ pro pending-login odpověď.
 */

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
  /** Vlastní volba uživatele - self-service toggle na personal-info stránce. */
  enable_2fa?: boolean;
  /** Sysadmin override - vynucuje 2FA nezávisle na enable_2fa. Viditelné/měnitelné jen sysadminem. */
  two_fa_forced_by_admin?: boolean;
}

/**
 * @description Tvar odpovědi backendu, když je vyžadována 2FA - login ještě NENÍ
 * dokončen, tokeny se vydají až po AuthService.verifyTwoFactor().
 */
export interface LoginTwoFactorChallenge {
  requires_2fa: true;
  login_token: string;
  expires_in: number;
  message: string;
}