{{--
    @file raw-request-commission-received.blade.php
    @path app/Apps/Web/Resources/views/emails/raw-request-commission-received.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Confirmation of a received inquiry (WebRawRequestCommission), same look as
    emails/auth/*.blade.php (header bar, card, shared company footer); the summary table uses the
    same palette (#18181b / #71717a / #ececea).
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')

@section('lang', 'cs')
@section('title', 'Poptávka přijata')
@section('padding', '32px')

@section('content')
<h1 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#18181b;">
{{ $emailTitle }}
</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
{{ $emailGreeting }}
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
{{ $emailIntro }}
</p>

<p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;">
{{ $emailSummaryHeader }}
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:24px;">
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;width:38%;border-bottom:1px solid #ececea;">{{ $emailLabelThema }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $requestCommission->thema }}</td>
</tr>
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelEmail }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $requestCommission->contact_email }}</td>
</tr>
@if($requestCommission->contact_phone)
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelPhone }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $requestCommission->contact_phone }}</td>
</tr>
@endif
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelDescription }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;white-space:pre-line;border-bottom:1px solid #ececea;">{{ $requestCommission->order_description }}</td>
</tr>
@if($requestCommission->attachments && $requestCommission->attachments->count() > 0)
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelAttachments }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">
@foreach($requestCommission->attachments as $attachment)
{{ $attachment->original_filename }}@if(!$loop->last)<br>@endif
@endforeach
</td>
</tr>
@endif
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;">{{ $emailLabelDate }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;">{{ $requestCommission->created_at->format('d.m.Y H:i') }}</td>
</tr>
</table>

<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
{{ $emailOutro }}
</p>
@endsection
