{{--
    @file project-client-update.blade.php
    @path resources/views/emails/web/project-client-update.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Notification of a client account (ProjectClientUpdateMail): a new reply of the
    supplier or a checkpoint change in the project portal - the project, the thread subject /
    checkpoint title and a link to the portal, never a message text. Same look as the other
    transactional e-mails, shared footer with the company contacts.
--}}
<!DOCTYPE html>
<html lang="{{ $emailHtmlLang }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ $projectName }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececea;">

{{-- Header bar --}}
<tr>
<td style="background:#18181b;padding:20px 32px;">
<span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;">{{ $projectName }}</span>
</td>
</tr>

{{-- Body --}}
<tr>
<td style="padding:28px 32px;">
<p style="margin:0 0 12px;font-size:15px;color:#18181b;">{{ $intro }}</p>
<p style="margin:0 0 24px;padding:12px 16px;background:#fafafa;border:1px solid #ececea;border-radius:10px;font-size:15px;font-weight:600;color:#18181b;">{{ $itemTitle }}</p>
<a href="{{ $portalUrl }}" style="display:inline-block;padding:11px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">{{ $buttonText }}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a;">{{ $outro }}</p>
@include('emails.partials.footer')
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
