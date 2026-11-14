{{--
    @file card.blade.php
    @path resources/views/emails/layouts/card.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Shared shell of the e-mails of the applications (orders, inquiries, project
    portal): light grey page, white card with a dark header bar (brand / project name), the body of
    the e-mail and the shared company footer (emails/partials/footer.blade.php). Tables and inline
    styles only (e-mail clients).
    @usage @extends('emails.layouts.card') with the sections `title` (document title), `content`
    (body of the card) and optionally `lang` (html lang, default $emailHtmlLang or 'en'), `brand`
    (text of the header bar, default the company name), `width` (max width in px, default 560),
    `padding` (padding of the body cell, default "28px 32px").
--}}
<!DOCTYPE html>
<html lang="@yield('lang', $emailHtmlLang ?? 'en')">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@yield('title')</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:@yield('width', '560')px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececea;">

{{-- Header bar --}}
<tr>
<td style="background:#18181b;padding:20px 32px;">
<span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;">@yield('brand', $companyName ?? config('app.name'))</span>
</td>
</tr>

{{-- Body --}}
<tr>
<td style="padding:@yield('padding', '28px 32px');">
@yield('content')
@include('emails.partials.footer')
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
