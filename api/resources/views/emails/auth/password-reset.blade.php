<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <title>Reset hesla</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f4f4f5; padding:24px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
        <h2 style="margin-top:0;">Žádost o reset hesla</h2>

        <p>Dobrý den,</p>
        <p>
            obdrželi jsme žádost o reset hesla pro administrátorský účet
            <strong>{{ $user->user_email }}</strong>.
        </p>
        <p>
            Pokud jste o reset požádali vy, klikněte na tlačítko níže a nastavte si nové heslo.
            Odkaz je platný <strong>{{ $expiresInMinutes }} minut</strong> a lze jej použít pouze jednou.
        </p>

        <p style="text-align:center;margin:32px 0;">
            <a href="{{ $resetUrl }}"
               style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;">
                Nastavit nové heslo
            </a>
        </p>

        <p style="color:#6b7280;font-size:13px;">
            Pokud jste o reset hesla nežádali, tento e-mail prosím ignorujte - vaše heslo zůstane beze změny.
            Pokud odkaz nefunguje, zkopírujte tento text do prohlížeče:<br>
            <span style="word-break:break-all;">{{ $resetUrl }}</span>
        </p>
    </div>
</body>
</html>