<?php

/**
 * @file PasswordChangedNotification.php
 * @path app/Mail/Auth/PasswordChangedNotification.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Informativní e-mail odeslaný vždy po úspěšné změně hesla (bez odkazu).
 */

namespace App\Mail\Auth;

use App\Models\User;
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
            subject: 'Vaše heslo bylo změněno - RPSW Administrace',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.password-changed',
        );
    }
}