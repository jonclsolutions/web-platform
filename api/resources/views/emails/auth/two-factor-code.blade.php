{{--
    @file two-factor-code.blade.php
    @path resources/views/emails/auth/two-factor-code.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description 2FA code that finishes the login, same look as password-reset.blade.php. The code
    stands in its own frame (large letters, letter spacing) - easy to read and copy on a phone.
    Shell, brand header and company footer: emails/layouts/auth.blade.php.
--}}
@extends('emails.layouts.auth')
@php
    /** Brand name and colour (also used by the layout) - the colour can come from the Mailable (accentColor). */
    $brand  = $companyName ?? config('app.name');
    $accent = $accentColor ?? '#18181b';
@endphp

@section('title', 'Your verification code')

{{-- Preheader: deliberately generic - the code must not appear in inbox previews --}}
@section('preheader')
    Use this code to complete your sign-in. It expires in {{ $expiresInMinutes }} minutes.
@endsection

@section('content')
{{-- Body copy --}}
<tr>
<td style="padding:24px 40px 0;">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        Hi {{ $user->full_name }},
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#484848;">
        Here is your verification code to complete your sign-in:
    </p>
</td>
</tr>

{{-- Verification code box --}}
<tr>
<td style="padding:0 40px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
    <td style="background:#fafafa;border:1px solid #dddddd;border-radius:4px;padding:16px 28px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:{{ $accent }};
                     font-family:'SFMono-Regular',Consolas,'Courier New',monospace;">
            {{ $code }}
        </span>
    </td>
    </tr>
    </table>
</td>
</tr>

{{-- Validity + warning --}}
<tr>
<td style="padding:0 40px 28px;">
    <p style="margin:0;font-size:16px;line-height:1.5;color:#484848;">
        The code is valid for {{ $expiresInMinutes }} minutes. If you didn't try
        to sign in, don't share this code with anyone and change your password
        right away.
    </p>
</td>
</tr>

{{-- Sign-off --}}
<tr>
<td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:16px;line-height:1.5;color:#484848;">
        Thanks,<br>
        The {{ $brand }} team
    </p>
</td>
</tr>
@endsection
