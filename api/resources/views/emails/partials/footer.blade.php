{{--
    @file footer.blade.php
    @path resources/views/emails/partials/footer.blade.php
    @project RPSW Web
    @author RPSW
    @created 2026
    @description Sdílená patička pro VŠECHNY transakční e-maily - název firmy + kontaktní
    e-mail/telefon. Proměnné ($companyName, $contactEmail, $contactPhone) dodává
    App\Support\Mail\CompanyContactInfo::get(), předané přes Content::with() v Mailable
    třídě - @include automaticky sdílí proměnné rodičovské view, není potřeba nic
    přeposílat ručně.
    @note Chybějící $contactEmail/$contactPhone (SiteSetting prázdný/nevyplněný) patičku
    nerozbije - řádek s kontaktem se v tom případě prostě vynechá, zůstane jen název firmy.
--}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr>
        <td style="padding-top:20px;border-top:1px solid #e4e4e7;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#3f3f46;">
                {{ $companyName ?? config('app.name') }}
            </p>
            @if (!empty($contactEmail) || !empty($contactPhone))
                <p style="margin:0;font-size:12px;color:#71717a;">
                    @if (!empty($contactEmail))
                        <a href="mailto:{{ $contactEmail }}" style="color:#2563eb;text-decoration:none;">{{ $contactEmail }}</a>
                    @endif
                    @if (!empty($contactEmail) && !empty($contactPhone))
                        <span style="margin:0 6px;color:#d4d4d8;">&middot;</span>
                    @endif
                    @if (!empty($contactPhone))
                        <span>{{ $contactPhone }}</span>
                    @endif
                </p>
            @endif
        </td>
    </tr>
</table>