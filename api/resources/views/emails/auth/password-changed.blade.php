<!--
    @file password-changed.blade.php
    @path resources/views/emails/auth/password-changed.blade.php
    @project RPSW Web
    @author RPSW
    @created 2026
    @description Notifikace o úspěšné změně hesla - přepracovaný vzhled (2026-08-19),
    stejný vizuální jazyk jako password-reset.blade.php. Bezpečnostní upozornění
    ("pokud jste to nebyli vy") zvýrazněné jemným rámečkem, ne jen barvou textu, ať lépe
    upoutá pozornost. Sdílená patička s firemním kontaktem - viz
    emails/partials/footer.blade.php.
-->
@php
    /** Brand name shown in header, sign-off and footer. */
    $brand  = $companyName ?? config('app.name');
    /** Brand colour - override from the Mailable via Content::with(['accentColor' => ...]). */
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
<title>Your password was changed</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<!-- Preheader: preview text shown in the inbox list, hidden in the body -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    The password for your account was changed on {{ $changedAt }}.
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
        The password for your account
        <strong style="color:#222222;">{{ $user->user_email }}</strong>
        was successfully changed on
        <strong style="color:#222222;">{{ $changedAt }}</strong>.
    </p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#484848;">
        For your security, all active sessions have been signed out.
    </p>
</td>
</tr>

<!-- Security notice -->
<tr>
<td style="padding:0 40px 28px;">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:14px 16px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#b91c1c;">
            <strong>Wasn't you?</strong> If you didn't make this change,
            contact your system administrator immediately.
        </p>
    </div>
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