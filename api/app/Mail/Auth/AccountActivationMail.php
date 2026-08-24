<?php
/**
 * @file AccountActivationMail.php
 * @path app/Mail/Auth/AccountActivationMail.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Aktivační e-mail s odkazem na nastavení hesla nově vytvořeného účtu.
 * Odkaz vede na veřejnou (nepřihlášenou) frontend stránku `/activate-account/{token}`.
 * @note `config('app.frontend_url')` musí být nastaveno v `.env` (FRONTEND_URL) -
 * stejná proměnná, jaká už se pravděpodobně používá pro reset-password odkazy
 * (PasswordResetController) - pokud tam existuje jiný klíč, uprav podle něj.
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

        return $this->subject('Aktivace vašeho účtu')
            ->view('emails.auth.account-activation')
            ->with([
                'fullName' => $this->user->full_name,
                'link'     => $link,
                'hours'    => AccountActivationToken::EXPIRES_HOURS,
            ]);
    }
}