<?php
/**
 * @file AccountActivationMail.php
 * @path app/Mail/Auth/AccountActivationMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Activation e-mail of a new account with the link to set the password. The link
 * leads to the public frontend page `/activate-account/{token}`.
 * @note Needs `config('app.frontend_url')` (FRONTEND_URL in .env), like the password reset
 * links (PasswordResetController).
 */

namespace App\Mail\Auth;

use App\Models\AccountActivationToken;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AccountActivationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $rawToken
    ) {}

    public function build(): self
    {
        $link = rtrim(config('app.frontend_url'), '/') . '/auth/activate-account/' . $this->rawToken;

        return $this->subject('Activating your account')
            ->view('emails.auth.account-activation')
            ->with([
                'fullName' => $this->user->full_name,
                'link'     => $link,
                'hours'    => AccountActivationToken::EXPIRES_HOURS,
            ]);
    }
}