<?php

/**
 * @file PasswordResetRequested.php
 * @path app/Mail/Auth/PasswordResetRequested.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description E-mail s odkazem na dočasnou frontend stránku pro nastavení nového hesla.
 *              Odkaz obsahuje RAW token pouze zde (v e-mailu), v DB je uložen jen jeho hash.
 * @refactor-note (2026-08-19) BACKLOG "hezčí a přehlednější maily": šablona přepracována
 * (viz emails/auth/password-reset.blade.php) a doplněna o firemní kontakt v patičce -
 * `content()` teď předává `CompanyContactInfo::get()` (companyName/contactEmail/
 * contactPhone) přes `Content::with()`, odkud se proměnné dostanou do view i do
 * sdíleného `emails/partials/footer.blade.php` partialu (@include automaticky sdílí
 * proměnné rodičovské view).
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
            subject: 'Žádost o reset hesla - RPSW Administrace',
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