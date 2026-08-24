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
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <title>Aktivace účtu</title>
</head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family: 'Segoe UI', system-ui, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5; padding:32px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0"
                       style="background:#ffffff; border:1px solid #e4e6ea; border-radius:14px; padding:32px;">
                    <tr>
                        <td>
                            <h1 style="margin:0 0 8px; font-size:1.25rem; color:#1a1d23;">Vítejte, {{ $fullName }}</h1>
                            <p style="margin:0 0 20px; font-size:0.95rem; color:#6b7280; line-height:1.5;">
                                Byl vám založen účet v administraci. Pro dokončení nastavení a
                                aktivaci účtu si prosím nastavte heslo kliknutím na tlačítko níže.
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="border-radius:8px; background:#1e88e5;">
                                        <a href="{{ $link }}"
                                           style="display:inline-block; padding:12px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:0.95rem;">
                                            Nastavit heslo a aktivovat účet
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:24px 0 0; font-size:0.8rem; color:#9ca3af; line-height:1.5;">
                                Odkaz je platný {{ $hours }} hodin. Pokud tlačítko nefunguje,
                                zkopírujte tento odkaz do prohlížeče:<br>
                                <span style="word-break:break-all; color:#1e88e5;">{{ $link }}</span>
                            </p>
                            <p style="margin:20px 0 0; font-size:0.78rem; color:#9ca3af;">
                                Pokud jste o založení účtu nežádali, tento e-mail ignorujte.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>