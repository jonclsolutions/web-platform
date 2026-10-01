<!--
    @file: account-activation.blade.php
    @path: resources/views/emails/auth/account-activation.blade.php
    @project: RPSW Web
    @author: RPSW
    @created: 2026
    @note: Základní samostatná šablona bez závislosti na sdíleném layoutu, protože jsem
    neměl k dispozici stávající layout/partial pro TwoFactorCodeMail/PasswordChangedNotification.
    Pokud v projektu existuje sdílený "emails.layout" (hlavička/patička firmy, logo), nahraď
    obálku <html>...</html> direktivou pro rozšíření layoutu a přesuň obsah do odpovídající
    sekce, ať e-mail vypadá konzistentně se zbytkem systému.
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
<title>Activate your account</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<!-- Preheader: preview text shown in the inbox list, hidden in the body -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    Your account has been created. Set your password to activate it.
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
        Hi {{ $fullName }},
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        An administrator account has been created for you. To finish the setup
        and activate your account, please set your password.
    </p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#484848;">
        The link is valid for {{ $hours }} hours and can only be used once.
    </p>
</td>
</tr>

<!-- CTA button (bulletproof table button) -->
<tr>
<td style="padding:0 40px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
    <td style="background:{{ $accent }};border-radius:4px;">
        <a href="{{ $link }}"
           style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;
                  color:#ffffff;text-decoration:none;border-radius:4px;">
            Set password and activate
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

<!-- Fallback link + "not requested" note -->
<tr>
<td style="padding:0 40px 32px;">
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#767676;">
        Button not working? Copy and paste this link into your browser:<br>
        <span style="word-break:break-all;color:#484848;">{{ $link }}</span>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
        If you weren't expecting this account, you can safely ignore this message.
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