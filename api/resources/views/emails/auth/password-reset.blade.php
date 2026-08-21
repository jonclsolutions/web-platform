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
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset hesla</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececea;">

<!-- Header pruh -->
<tr>
<td style="background:#18181b;padding:20px 32px;">
<span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;">
{{ $companyName ?? config('app.name') }}
</span>
</td>
</tr>

<!-- Obsah -->
<tr>
<td style="padding:32px;">
<h1 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#18181b;">
Žádost o reset hesla
</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
Dobrý den,
</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
obdrželi jsme žádost o reset hesla pro administrátorský účet
<strong style="color:#18181b;">{{ $user->user_email }}</strong>.
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
Pokud jste o reset požádali vy, klikněte na tlačítko níže a nastavte si nové heslo.
Odkaz je platný <strong style="color:#18181b;">{{ $expiresInMinutes }} minut</strong>
a lze jej použít pouze jednou.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td align="center">
<a href="{{ $resetUrl }}"
style="background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;
padding:13px 28px;border-radius:8px;display:inline-block;">
Nastavit nové heslo
</a>
</td>
</tr>
</table>

<div style="background:#fafafa;border:1px solid #ececea;border-radius:10px;padding:14px 16px;margin-bottom:8px;">
<p style="margin:0;font-size:12.5px;line-height:1.6;color:#71717a;">
Pokud jste o reset hesla nežádali, tento e-mail prosím ignorujte - vaše heslo
zůstane beze změny. Pokud tlačítko výše nefunguje, zkopírujte tento odkaz
přímo do prohlížeče:<br>
<span style="word-break:break-all;color:#52525b;">{{ $resetUrl }}</span>
</p>
</div>

@include('emails.partials.footer')

</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>