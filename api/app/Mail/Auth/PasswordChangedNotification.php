<?php

/**
 * @file PasswordChangedNotification.php
 * @path app/Mail/Auth/PasswordChangedNotification.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Information e-mail sent after every successful password change (no link).
 */

namespace App\Mail\Auth;

use App\Models\User;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordChangedNotification extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $changedAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your password has been changed',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.password-changed',
            with: CompanyContactInfo::get(),
        );
    }
}