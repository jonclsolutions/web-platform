<?php

/**
 * @file PasswordChangedNotification.php
 * @path app/Mail/Auth/PasswordChangedNotification.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Informativní e-mail odeslaný vždy po úspěšné změně hesla (bez odkazu).
 * @refactor-note (2026-08-19) BACKLOG "hezčí a přehlednější maily": šablona přepracována
 * (viz emails/auth/password-changed.blade.php) a doplněna o firemní kontakt v patičce
 * i v bezpečnostním upozornění ("kontaktujte správce na ...") - `content()` teď
 * předává `CompanyContactInfo::get()` přes `Content::with()`, stejně jako
 * PasswordResetRequested.
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