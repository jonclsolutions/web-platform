{{--
    @file sales-order-received.blade.php
    @path app/Apps/Web/Resources/views/emails/sales-order-received.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Confirmation of a received order (WebSalesOrder), same look as
    emails/auth/*.blade.php and raw-request-commission-received.blade.php. All texts come from
    SalesOrderEmailTemplate in the language of the order (VT-15).
--}}
<!DOCTYPE html>
<html lang="{{ $emailHtmlLang }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ $emailTitle }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececea;">

{{-- Header bar --}}
<tr>
<td style="background:#18181b;padding:20px 32px;">
<span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;">
{{ $companyName ?? config('app.name') }}
</span>
</td>
</tr>

{{-- Content --}}
<tr>
<td style="padding:32px;">
<h1 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#18181b;">
{{ $emailTitle }}
</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
{{ $emailGreeting }}{{ $order->client_name ? ', ' . $order->client_name : '' }},
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
{{ $emailIntro }}
</p>

<p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;">
{{ $emailSummaryHeader }}
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:24px;">
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;width:38%;border-bottom:1px solid #ececea;">{{ $emailLabelName }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $order->client_name }}</td>
</tr>
@if($order->ico)
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelIco }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $order->ico }}</td>
</tr>
@endif
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelEmail }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $order->client_email }}</td>
</tr>
@if($order->client_phone)
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelPhone }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $order->client_phone }}</td>
</tr>
@endif
@if($order->client_address)
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelAddress }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">{{ $order->client_address }}</td>
</tr>
@endif
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelDescription }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;white-space:pre-line;border-bottom:1px solid #ececea;">{{ $order->order_description }}</td>
</tr>
@if($order->attachments && $order->attachments->count() > 0)
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;">{{ $emailLabelAttachments }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;">
@foreach($order->attachments as $attachment)
{{ $attachment->original_filename }}@if(!$loop->last)<br>@endif
@endforeach
</td>
</tr>
@endif
<tr>
<td style="padding:12px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;">{{ $emailLabelDate }}</td>
<td style="padding:12px 16px;font-size:13px;color:#18181b;">{{ $order->created_at->format('d.m.Y H:i') }}</td>
</tr>
</table>

<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
{{ $emailOutro }}
</p>

@include('emails.partials.footer')

</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>