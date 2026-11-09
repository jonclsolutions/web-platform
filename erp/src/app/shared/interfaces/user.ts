/**
 * @file user.ts
 * @path src/app/shared/interfaces/user.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Shared TypeScript interfaces for user/role data across the admin app.
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
  /** Account ID of the API (UserResource). */
  id?: number;
  /** Signed URL of the profile photo, null = the default image. */
  avatar_url?: string | null;
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
  /** The user's own choice - self-service toggle on the personal-info page. */
  enable_2fa?: boolean;
  /** Sysadmin override - enforces 2FA regardless of enable_2fa. Visible / changeable by a sysadmin only. */
  two_fa_forced_by_admin?: boolean;
}

/**
 * @description Shape of the backend answer when 2FA is required - the login is NOT finished yet,
 * the tokens are issued only after AuthService.verifyTwoFactor().
 */
export interface LoginTwoFactorChallenge {
  requires_2fa: true;
  login_token: string;
  expires_in: number;
  message: string;
}