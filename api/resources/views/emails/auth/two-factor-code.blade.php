<!--
    @file: two-factor-code.blade.php
    @path: resources/views/emails/auth/two-factor-code.blade.php
    @project: RPSW Web
    @author RPSW
    @created 2026
    @description Ověřovací 2FA kód pro dokončení přihlášení - přepracovaný vzhled
    (2026-08-19), stejný vizuální jazyk jako password-reset.blade.php/
    password-changed.blade.php. Kód zvýrazněný ve vlastním rámečku (velké písmo,
    rozestupy mezi znaky) místo prostého <h2> - lépe čitelné/opsatelné na mobilu.
    Sdílená patička s firemním kontaktem - viz emails/partials/footer.blade.php.
-->
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ověřovací kód</title>
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
Ověřovací kód pro přihlášení
</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
Dobrý den {{ $user->full_name }},
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
váš ověřovací kód pro dokončení přihlášení je:
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr>
<td align="center">
<div style="display:inline-block;background:#fafafa;border:1px solid #ececea;border-radius:10px;padding:16px 32px;">
<span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;font-family:'Courier New',monospace;">
{{ $code }}
</span>
</div>
</td>
</tr>
</table>

<div style="background:#fafafa;border:1px solid #ececea;border-radius:10px;padding:14px 16px;margin-bottom:8px;">
<p style="margin:0;font-size:12.5px;line-height:1.6;color:#71717a;">
Kód je platný <strong style="color:#3f3f46;">{{ $expiresInMinutes }} minut</strong>.
Pokud jste o přihlášení nežádali, kód nikomu nesdělujte a ihned si změňte heslo.
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