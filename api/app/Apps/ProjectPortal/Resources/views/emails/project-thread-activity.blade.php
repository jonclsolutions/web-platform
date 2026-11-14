{{--
    @file project-thread-activity.blade.php
    @path app/Apps/ProjectPortal/Resources/views/emails/project-thread-activity.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Internal notification (ProjectThreadActivityMail) to the responsible
    administrator / the project's contact e-mail about customer activity in a project thread - only
    the thread subject and a link to the project page of the administration, never the message text.
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')

@section('title', $projectName)
@section('brand', $projectName)

@section('content')
<p style="margin:0 0 12px;font-size:15px;color:#18181b;">
{{ $isNewThread ? 'The customer started a new thread:' : 'The customer wrote a new message in the thread:' }}
</p>
<p style="margin:0 0 24px;padding:12px 16px;background:#fafafa;border:1px solid #ececea;border-radius:10px;font-size:15px;font-weight:600;color:#18181b;">
{{ $threadSubject }}
</p>
<a href="{{ $adminUrl }}" style="display:inline-block;padding:11px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;">
Open in the administration
</a>
@endsection
