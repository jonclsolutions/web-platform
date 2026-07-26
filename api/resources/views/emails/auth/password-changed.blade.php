<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <title>Heslo bylo změněno</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f4f4f5; padding:24px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
        <h2 style="margin-top:0;">Vaše heslo bylo změněno</h2>

        <p>Dobrý den,</p>
        <p>
            heslo k administrátorskému účtu <strong>{{ $user->user_email }}</strong>
            bylo úspěšně změněno dne {{ $changedAt }}.
        </p>
        <p>
            Všechna dosavadní přihlášení byla z bezpečnostních důvodů odhlášena.
        </p>

        <p style="color:#b91c1c;font-size:13px;margin-top:24px;">
            Pokud jste tuto změnu neprovedli vy, neprodleně kontaktujte správce systému.
        </p>
    </div>
</body>
</html>