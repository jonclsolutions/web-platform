{{--
    @file account-activation.blade.php
    @path resources/views/emails/auth/account-activation.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Account activation e-mail with the link to set the password; shell, brand
    header and company footer: emails/layouts/auth.blade.php.
--}}
@extends('emails.layouts.auth')
@php
    /** Brand name and colour (also used by the layout) - the colour can come from the Mailable (accentColor). */
    $brand  = $companyName ?? config('app.name');
    $accent = $accentColor ?? '#18181b';
@endphp

@section('title', 'Activate your account')

{{-- Preheader: preview text shown in the inbox list, hidden in the body --}}
@section('preheader')
    Your account has been created. Set your password to activate it.
@endsection

@section('content')
{{-- Body copy --}}
<tr>
<td style="padding:24px 40px 0;">
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        Hi {{ $fullName }},
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#484848;">
        An administrator account has been created for you. To finish the setup
        and activate your account, please set your password.
    </p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.5;color:#484848;">
        The link is valid for {{ $hours }} hours and can only be used once.
    </p>
</td>
</tr>

{{-- CTA button (bulletproof table button) --}}
<tr>
<td style="padding:0 40px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
    <td style="background:{{ $accent }};border-radius:4px;">
        <a href="{{ $link }}"
           style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:600;
                  color:#ffffff;text-decoration:none;border-radius:4px;">
            Set password and activate
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

{{-- Fallback link + "not requested" note --}}
<tr>
<td style="padding:0 40px 32px;">
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#767676;">
        Button not working? Copy and paste this link into your browser:<br>
        <span style="word-break:break-all;color:#484848;">{{ $link }}</span>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
        If you weren't expecting this account, you can safely ignore this message.
    </p>
</td>
</tr>
@endsection
