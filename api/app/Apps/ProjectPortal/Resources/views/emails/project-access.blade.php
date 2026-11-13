{{--
    @file project-access.blade.php
    @path app/Apps/ProjectPortal/Resources/views/emails/project-access.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Access e-mail of a client account (ProjectAccessMail): the invitation to the
    project portal, or a requested sign-in code - the code (if any), a one-time sign-in button, its
    validity and what to do when the client did not ask for it. Same look as the other
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#18181b;">{{ $intro }}</p>
@if ($code)
<p style="margin:0 0 20px;padding:14px 16px;background:#fafafa;border:1px solid #ececea;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:0.3em;text-align:center;color:#18181b;font-family:'SFMono-Regular',Consolas,monospace;">{{ $code }}</p>
@endif
<a href="{{ $accessUrl }}" style="display:inline-block;padding:11px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">{{ $buttonText }}</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#3f3f46;">{{ $note }}</p>
<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#71717a;">{{ $outro }}</p>
@include('emails.partials.footer')
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
