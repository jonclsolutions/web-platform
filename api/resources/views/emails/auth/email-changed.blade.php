{{--
    @file email-changed.blade.php
    @path resources/views/emails/auth/email-changed.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Notification of a change of the login e-mail (sent to the previous and the new
    address), same look as password-changed.blade.php. The security notice ("if it was not you") is framed to stand out.
    Shell, brand header and company footer: emails/layouts/auth.blade.php.
--}}
@extends('emails.layouts.auth')
@php
    /** Brand name and colour (also used by the layout) - the colour can come from the Mailable (accentColor). */
    $brand  = $companyName ?? config('app.name');
    $accent = $accentColor ?? '#18181b';
@endphp

@section('title', 'Your login e-mail was changed')

{{-- Preheader: preview text shown in the inbox list, hidden in the body --}}
@section('preheader')
    The login e-mail of your account was changed on {{ $changedAt }}.
@endsection

@section('content')
{{-- Body copy --}}
<tr>
<td style="padding:24px 40px 0;">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        Hi,
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        The login e-mail of your account was changed on
        <strong style="color:#222222;">{{ $changedAt }}</strong>
        from <strong style="color:#222222;">{{ $previousEmail }}</strong>
        to <strong style="color:#222222;">{{ $user->user_email }}</strong>.
        Use the new address to sign in from now on.
    </p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#484848;">
        For your security, the other active sessions of the account have been signed out.
    </p>
</td>
</tr>

{{-- Security notice --}}
<tr>
<td style="padding:0 40px 28px;">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:14px 16px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#b91c1c;">
            <strong>Wasn't you?</strong> If you didn't make this change,
            contact your system administrator immediately.
        </p>
    </div>
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
