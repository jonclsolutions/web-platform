{{--
    @file password-changed.blade.php
    @path resources/views/emails/auth/password-changed.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Notification of a successful password change, same look as
    password-reset.blade.php. The security notice ("if it was not you") is framed to stand out.
    Shell, brand header and company footer: emails/layouts/auth.blade.php.
--}}
@extends('emails.layouts.auth')
@php
    /** Brand name and colour (also used by the layout) - the colour can come from the Mailable (accentColor). */
    $brand  = $companyName ?? config('app.name');
    $accent = $accentColor ?? '#18181b';
@endphp

@section('title', 'Your password was changed')

{{-- Preheader: preview text shown in the inbox list, hidden in the body --}}
@section('preheader')
    The password for your account was changed on {{ $changedAt }}.
@endsection

@section('content')
{{-- Body copy --}}
<tr>
<td style="padding:24px 40px 0;">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        Hi,
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        The password for your account
        <strong style="color:#222222;">{{ $user->user_email }}</strong>
        was successfully changed on
        <strong style="color:#222222;">{{ $changedAt }}</strong>.
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
