<?php

/**
 * @file PasswordResetRequested.php
 * @path app/Mail/Auth/PasswordResetRequested.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description E-mail with the link to the frontend page for setting a new password.
 *              The RAW token exists only here (in the e-mail); the database stores its hash.
 */

namespace App\Mail\Auth;

use App\Models\User;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetRequested extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $resetUrl,
        public int $expiresInMinutes
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Password reset request',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.password-reset',
            with: CompanyContactInfo::get(),
        );
    }
}