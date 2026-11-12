<?php
/**
 * @file WebProjectAccountResource.php
 * @path app/Http/Resources/Web/WebProjectAccountResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Client account of the portal for the administration (never the password hash).
 *   `active_sessions` = devices currently signed in (when counted).
 * @dependencies App\Models\Web\WebProjectAccount
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectAccountResource extends JsonResource
{
    /**
     * @description Fields of the account.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'username'        => $this->username,
            'display_name'    => $this->display_name,
            'email'           => $this->email,
            // Chosen by the client in the portal (read-only for the administration).
            'notify_replies'           => (bool) $this->notify_replies,
            'notify_checkpoint_status' => (bool) $this->notify_checkpoint_status,
            'notify_checkpoint_dates'  => (bool) $this->notify_checkpoint_dates,
            'language'        => $this->language,
            'notify_updates'           => (bool) $this->notify_updates,
            'notify_approvals'         => (bool) $this->notify_approvals,
            'has_password'      => !empty($this->password_hash),
            'email_verified_at' => $this->email_verified_at?->format('Y-m-d H:i:s'),
            'invited_at'        => $this->invited_at?->format('Y-m-d H:i:s'),
            'password_set_at' => $this->password_set_at?->format('Y-m-d H:i:s'),
            'last_login_at'   => $this->last_login_at?->format('Y-m-d H:i:s'),
            'active_sessions' => $this->when(isset($this->active_sessions_count), fn () => (int) $this->active_sessions_count),
            'created_at'      => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}
