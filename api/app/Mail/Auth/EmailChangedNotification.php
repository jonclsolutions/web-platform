<?php

/**
 * @file EmailChangedNotification.php
 * @path app/Mail/Auth/EmailChangedNotification.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Information e-mail sent after a change of the login e-mail of an account (no
 * link) - to the PREVIOUS address (the owner learns about a change he did not make) and to the
 * new one.
 */

namespace App\Mail\Auth;

use App\Models\User;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmailChangedNotification extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param User $user Account (already with the new e-mail).
     * @param string $previousEmail Login e-mail before the change.
     * @param string $changedAt Time of the change (display format).
     */
    public function __construct(
        public User $user,
        public string $previousEmail,
        public string $changedAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your login e-mail has been changed',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.email-changed',
            with: CompanyContactInfo::get(),
        );
    }
}