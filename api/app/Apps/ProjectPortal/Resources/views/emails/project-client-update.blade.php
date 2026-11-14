{{--
    @file project-client-update.blade.php
    @path app/Apps/ProjectPortal/Resources/views/emails/project-client-update.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Notification of a client account (ProjectClientUpdateMail): a new reply of the
    supplier or a checkpoint change in the project portal - the project, the thread subject /
    checkpoint title and a link to the portal, never a message text. Same look as the other
    transactional e-mails, shared footer with the company contacts.
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')

@section('title', $projectName)
@section('brand', $projectName)

@section('content')
<p style="margin:0 0 12px;font-size:15px;color:#18181b;">{{ $intro }}</p>
<p style="margin:0 0 24px;padding:12px 16px;background:#fafafa;border:1px solid #ececea;border-radius:10px;font-size:15px;font-weight:600;color:#18181b;">{{ $itemTitle }}</p>
<a href="{{ $portalUrl }}" style="display:inline-block;padding:11px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">{{ $buttonText }}</a>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a;">{{ $outro }}</p>
@endsection
