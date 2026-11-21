{{--
    @file unpaid-order.blade.php
    @path app/Apps/Shop/Resources/views/emails/unpaid-order.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description E-mail of an unpaid bank-transfer order (ShopUnpaidOrderMail, audit B-04), same look
    as the order confirmation: $kind 'reminder' = payment reminder (order, total, pay-by day,
    payment details), 'canceled' = the order was cancelled for no payment (order, total). All texts
    come from ShopOrderEmailTemplate in the language of the order ($tpl); everything is escaped.
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')
@php
    $l = $tpl['labels'];
    $title = $l[$kind . '_subject'];
    $label = 'padding:10px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;width:38%;border-bottom:1px solid #ececea;';
    $value = 'padding:10px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;';
@endphp

@section('lang', $tpl['htmlLang'])
@section('title', $title)
@section('width', '600')
@section('padding', '32px')

@section('content')
<h1 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#18181b;">{{ $title }}</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
{{ $l['greeting'] }}{{ $contact['full_name'] !== '' ? ', ' . $contact['full_name'] : '' }},
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;white-space:pre-line;">{{ $l[$kind . '_intro'] }}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:24px;">
<tr>
<td style="{{ $label }}">{{ $l['label_order_number'] }}</td>
<td style="{{ $value }}font-weight:700;">{{ $order->order_number }}</td>
</tr>
<tr>
<td style="{{ $label }}">{{ $l['label_date'] }}</td>
<td style="{{ $value }}">{{ $order->created_at->format('d.m.Y H:i') }}</td>
</tr>
@if ($order->paymentMethod)
<tr>
<td style="{{ $label }}">{{ $l['label_payment'] }}</td>
<td style="{{ $value }}">{{ $order->paymentMethod->name }}</td>
</tr>
@endif
<tr>
<td style="{{ $label }}{{ $payBy ? '' : 'border-bottom:0;' }}">{{ $l['label_total'] }}</td>
<td style="{{ $value }}{{ $payBy ? '' : 'border-bottom:0;' }}font-weight:700;">{{ $total }}</td>
</tr>
@if ($payBy)
<tr>
<td style="{{ $label }}border-bottom:0;">{{ $l['label_pay_by'] }}</td>
<td style="{{ $value }}border-bottom:0;font-weight:700;">{{ $payBy }}</td>
</tr>
@endif
</table>

@include('shop::emails.partials.payment-details')

<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">{{ $tpl['outro'] }}</p>
@endsection
