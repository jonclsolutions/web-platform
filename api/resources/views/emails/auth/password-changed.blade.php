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
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Heslo bylo změněno</title>
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
Vaše heslo bylo změněno
</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
Dobrý den,
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
heslo k administrátorskému účtu <strong style="color:#18181b;">{{ $user->user_email }}</strong>
bylo úspěšně změněno dne <strong style="color:#18181b;">{{ $changedAt }}</strong>.
Všechna dosavadní přihlášení byla z bezpečnostních důvodů odhlášena.
</p>

<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin-bottom:8px;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#b91c1c;">
<strong>Nebyli jste to vy?</strong> Pokud jste tuto změnu neprovedli, neprodleně
kontaktujte správce systému.
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