{{--
    @file auth.blade.php
    @path resources/views/emails/layouts/auth.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Shared shell of the account e-mails (activation, password reset / change, login
    e-mail change, two-factor code): light page, white card with the brand header (logo + company
    name), the body rows of the e-mail and the shared company footer
    (emails/partials/footer.blade.php). Tables and inline styles only (e-mail clients).
    @usage @extends('emails.layouts.auth') with the sections `title`, `preheader` (inbox preview
    text, hidden in the body) and `content` (table rows `<tr>` of the body). The child defines
    $brand / $accent (also used in its body); missing ones fall back to the company name and
    #18181b here.
    @note The logo (PNG - SVG is not supported by Gmail / Outlook) lives in private storage and is
    embedded as an inline CID attachment; without the file the header shows the name only.
--}}
@php
    $brand ??= $companyName ?? config('app.name');
    $accent ??= $accentColor ?? '#18181b';
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
<title>@yield('title')</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

{{-- Preheader: preview text shown in the inbox list, hidden in the body --}}
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    @yield('preheader')
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;">

{{-- Brand header: logo + company name --}}
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

@yield('content')

{{-- Footer (muted, small; the partial draws its own dividing line) --}}
<tr>
<td style="padding:0 40px 36px;font-size:13px;line-height:1.7;color:#767676;">
    @include('emails.partials.footer')
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
