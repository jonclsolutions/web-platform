{{--
    @file project-access.blade.php
    @path app/Apps/ProjectPortal/Resources/views/emails/project-access.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Access e-mail of a client account (ProjectAccessMail): the invitation to the
    project portal, or a requested sign-in code - the code (if any), a one-time sign-in button, its
    validity and what to do when the client did not ask for it. Same look as the other
    transactional e-mails, shared footer with the company contacts.
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')

@section('title', $projectName)
@section('brand', $projectName)

@section('content')
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#18181b;">{{ $intro }}</p>
@if ($code)
<p style="margin:0 0 20px;padding:14px 16px;background:#fafafa;border:1px solid #ececea;border-radius:10px;font-size:28px;font-weight:700;letter-spacing:0.3em;text-align:center;color:#18181b;font-family:'SFMono-Regular',Consolas,monospace;">{{ $code }}</p>
@endif
<a href="{{ $accessUrl }}" style="display:inline-block;padding:11px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">{{ $buttonText }}</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#3f3f46;">{{ $note }}</p>
<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#71717a;">{{ $outro }}</p>
@endsection
