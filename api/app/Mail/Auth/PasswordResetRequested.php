<?php

/**
 * @file PasswordResetRequested.php
 * @path app/Mail/Auth/PasswordResetRequested.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description E-mail s odkazem na dočasnou frontend stránku pro nastavení nového hesla.
 *              Odkaz obsahuje RAW token pouze zde (v e-mailu), v DB je uložen jen jeho hash.
 */

namespace App\Mail\Auth;

use App\Models\User;
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
            subject: 'Žádost o reset hesla - RPSW Administrace',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth.password-reset',
        );
    }
}