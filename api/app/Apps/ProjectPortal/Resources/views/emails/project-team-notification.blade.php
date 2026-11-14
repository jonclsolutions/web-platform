{{--
    @file project-team-notification.blade.php
    @path app/Apps/ProjectPortal/Resources/views/emails/project-team-notification.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Internal notification of an administrator (ProjectTeamNotificationMail): a thread
    assigned to them / a client decision on an approval - the title and a link to the project in
    the administration, never a message text or comment.
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')

@section('title', $projectName)
@section('brand', $projectName)

@section('content')
<p style="margin:0 0 12px;font-size:15px;color:#18181b;">{{ $intro }}</p>
<p style="margin:0 0 24px;padding:12px 16px;background:#fafafa;border:1px solid #ececea;border-radius:10px;font-size:15px;font-weight:600;color:#18181b;">{{ $itemTitle }}</p>
<a href="{{ $adminUrl }}" style="display:inline-block;padding:11px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">Open in the administration</a>
@endsection
