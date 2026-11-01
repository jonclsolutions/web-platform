<?php

/**
 * @file TwoFactorCodeMail.php
 * @path app/Mail/Auth/TwoFactorCodeMail.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sends the 6-digit OTP code that finishes the login. Queued - sending the e-mail
 * must not block the login response.
 */

namespace App\Mail\Auth;

use App\Models\User;
use App\Support\Mail\CompanyContactInfo;
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
            subject: 'Login verification code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.two-factor-code',
            with: CompanyContactInfo::get(),
        );
    }
}