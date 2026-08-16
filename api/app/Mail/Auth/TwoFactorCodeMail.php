<?php

/**
 * @file TwoFactorCodeMail.php
 * @path app/Mail/Auth/TwoFactorCodeMail.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Odešle 6místný OTP kód pro dokončení přihlášení. Fronta (Queueable) -
 * odesílání e-mailu nesmí blokovat response loginu.
 */

namespace App\Mail\Auth;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TwoFactorCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $code,
        public int $expiresInMinutes
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Ověřovací kód pro přihlášení - RPSW Administrace',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.two-factor-code',
        );
    }
}