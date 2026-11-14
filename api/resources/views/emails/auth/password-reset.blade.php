{{--
    @file password-reset.blade.php
    @path resources/views/emails/auth/password-reset.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description E-mail with the password reset link (PasswordResetRequested), palette of the admin
    (#18181b / #71717a / #ececea). Shell, brand header and company footer:
    emails/layouts/auth.blade.php.
--}}
@extends('emails.layouts.auth')
@php
    /** Brand name and colour (also used by the layout) - the colour can come from the Mailable (accentColor). */
    $brand  = $companyName ?? config('app.name');
    $accent = $accentColor ?? '#18181b';
@endphp

@section('title', 'Reset your password')

{{-- Preheader: preview text shown in the inbox list, hidden in the body --}}
@section('preheader')
    We've received a request to reset your password. The link is valid for {{ $expiresInMinutes }} minutes.
@endsection

@section('content')
{{-- Body copy --}}
<tr>
<td style="padding:24px 40px 0;">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        Hi,
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        We've received a request to reset the password for your account
        <strong style="color:#222222;">{{ $user->user_email }}</strong>.
    </p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#484848;">
        If you didn't make the request, just ignore this message. Otherwise,
        you can reset your password. The link is valid for
        {{ $expiresInMinutes }} minutes and can only be used once.
    </p>
</td>
</tr>

{{-- CTA button (bulletproof table button, left-aligned like the reference) --}}
<tr>
<td style="padding:0 40px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
    <td style="background:{{ $accent }};border-radius:4px;">
        <a href="{{ $resetUrl }}"
           style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;
                  color:#ffffff;text-decoration:none;border-radius:4px;">
            Reset your password
        </a>
    </td>
    </tr>
    </table>
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

{{-- Fallback link --}}
<tr>
<td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
        Button not working? Copy and paste this link into your browser:<br>
        <span style="word-break:break-all;color:#484848;">{{ $resetUrl }}</span>
    </p>
</td>
</tr>
@endsection
