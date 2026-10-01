<!--
    @file password-reset.blade.php
    @path resources/views/emails/auth/password-reset.blade.php
    @project RPSW Web
    @author RPSW
    @created 2026
    @description E-mail s odkazem na reset hesla - přepracovaný vzhled (2026-08-19):
    jemný header pruh, konzistentní paleta se zbytkem administrace (#18181b/#71717a/
    #ececea), sdílená patička s firemním kontaktem (viz emails/partials/footer.blade.php,
    proměnné dodává App\Support\Mail\CompanyContactInfo::get() přes Content::with()
    v PasswordResetRequested Mailable třídě).
-->
@php
    /** Brand name shown in header, sign-off and footer. */
    $brand  = $companyName ?? config('app.name');
    /** CTA colour - override from the Mailable via Content::with(['accentColor' => ...]). */
    $accent = $accentColor ?? '#18181b';
    /**
     * Header logo (PNG - SVG is not supported by Gmail/Outlook).
     * Lives in private storage, embedded as an inline CID attachment.
     * If the file is missing, the header falls back to the name only.
     */
    $logoPath = storage_path('app/private/art/logo_small.png');
    $logoPath = is_readable($logoPath) ? $logoPath : null;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<!-- Preheader: preview text shown in the inbox list, hidden in the body -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    We've received a request to reset your password. The link is valid for {{ $expiresInMinutes }} minutes.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;">

<!-- Brand header: logo + company name -->
<tr>
<td style="padding:36px 40px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
        @if ($logoPath)
        <td style="padding-right:12px;vertical-align:middle;">
            {{-- Inline CID attachment - logo stays in private storage, no external request --}}
            <img src="{{ $message->embed($logoPath) }}"
                 alt="{{ $brand }}"
                 width="36" height="36"
                 style="display:block;width:36px;height:36px;border:0;outline:none;text-decoration:none;">
        </td>
        @endif
        <td style="vertical-align:middle;">
            <span style="font-size:22px;font-weight:700;letter-spacing:-0.01em;color:{{ $accent }};">
                {{ $brand }}
            </span>
        </td>
    </tr>
    </table>
</td>
</tr>

<!-- Body copy -->
<tr>
<td style="padding:24px 40px 0;">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        Hi,
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        We've received a request to reset the password for your account
        <strong style="color:#222222;">{{ $user->user_email }}</strong>.
    </p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#484848;">
        If you didn't make the request, just ignore this message. Otherwise,
        you can reset your password. The link is valid for
        {{ $expiresInMinutes }} minutes and can only be used once.
    </p>
</td>
</tr>

<!-- CTA button (bulletproof table button, left-aligned like the reference) -->
<tr>
<td style="padding:0 40px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
    <td style="background:{{ $accent }};border-radius:4px;">
        <a href="{{ $resetUrl }}"
           style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;
                  color:#ffffff;text-decoration:none;border-radius:4px;">
            Reset your password
        </a>
    </td>
    </tr>
    </table>
</td>
</tr>

<!-- Sign-off -->
<tr>
<td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:16px;line-height:1.5;color:#484848;">
        Thanks,<br>
        The {{ $brand }} team
    </p>
</td>
</tr>

<!-- Fallback link -->
<tr>
<td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
        Button not working? Copy and paste this link into your browser:<br>
        <span style="word-break:break-all;color:#484848;">{{ $resetUrl }}</span>
    </p>
</td>
</tr>

<!-- Divider -->
<tr>
<td style="padding:0 40px;">
    <div style="border-top:1px solid #dddddd;line-height:0;font-size:0;">&nbsp;</div>
</td>
</tr>

<!-- Footer (muted, small) -->
<tr>
<td style="padding:24px 40px 36px;font-size:13px;line-height:1.7;color:#767676;">
    @include('emails.partials.footer')
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>