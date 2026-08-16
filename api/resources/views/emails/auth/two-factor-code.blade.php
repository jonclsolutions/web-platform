{{-- 
    @file: two-factor-code.blade.php
    @path: resources/views/emails/auth/two-factor-code.blade.php
    @project: RPSW Web
--}}
<p>Dobrý den {{ $user->full_name }},</p>

<p>váš ověřovací kód pro dokončení přihlášení je:</p>

<h2 style="letter-spacing: 4px;">{{ $code }}</h2>

<p>Kód je platný {{ $expiresInMinutes }} minut. Pokud jste o přihlášení nežádali, kód nikomu nesdělujte a ihned si změňte heslo.</p>