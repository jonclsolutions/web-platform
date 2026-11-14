{{--
    @file order-confirmation.blade.php
    @path app/Apps/Shop/Resources/views/emails/order-confirmation.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Confirmation of an e-shop order (ShopOrderConfirmation), same look as the other
    confirmation e-mails: order number and date, items,
    prices, shipping / payment, delivery address and contact, right of withdrawal and the link to
    the terms and conditions (Directive 2011/83/EU, Art. 8(7)). All texts come from
    ShopOrderEmailTemplate in the language of the order ($tpl), amounts are formatted ($items,
    $amounts); everything is escaped ({{ }}), the buyer's note keeps its line breaks.
    Shell (header bar, card, company footer): emails/layouts/card.blade.php.
--}}
@extends('emails.layouts.card')
@php
    $l = $tpl['labels'];
    $th = 'padding:10px 12px;background:#fafafa;font-size:12px;font-weight:600;color:#52525b;border-bottom:1px solid #ececea;';
    $td = 'padding:10px 12px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;';
    $label = 'padding:10px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;width:38%;border-bottom:1px solid #ececea;';
    $value = 'padding:10px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;';
@endphp

@section('lang', $tpl['htmlLang'])
@section('title', $tpl['title'])
@section('width', '600')
@section('padding', '32px')

@section('content')
<h1 style="margin:0 0 20px;font-size:19px;font-weight:700;color:#18181b;">{{ $tpl['title'] }}</h1>

<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
{{ $l['greeting'] }}{{ $contact['full_name'] !== '' ? ', ' . $contact['full_name'] : '' }},
</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">{{ $tpl['intro'] }}</p>

<p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;">{{ $l['summary_header'] }}</p>

{{-- Order number + date --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:16px;">
<tr>
<td style="{{ $label }}">{{ $l['label_order_number'] }}</td>
<td style="{{ $value }}font-weight:700;">{{ $order->order_number }}</td>
</tr>
<tr>
<td style="{{ $label }}border-bottom:0;">{{ $l['label_date'] }}</td>
<td style="{{ $value }}border-bottom:0;">{{ $order->created_at->format('d.m.Y H:i') }}</td>
</tr>
</table>

{{-- Items --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:16px;">
<tr>
<td style="{{ $th }}">{{ $l['label_product'] }}</td>
<td style="{{ $th }}text-align:center;">{{ $l['label_quantity'] }}</td>
<td style="{{ $th }}text-align:right;">{{ $l['label_unit_price'] }}</td>
<td style="{{ $th }}text-align:right;">{{ $l['label_line_total'] }}</td>
</tr>
@foreach ($items as $item)
<tr>
<td style="{{ $td }}">{{ $item['name'] }}</td>
<td style="{{ $td }}text-align:center;white-space:nowrap;">{{ $item['quantity'] }}</td>
<td style="{{ $td }}text-align:right;white-space:nowrap;">{{ $item['unit'] }}</td>
<td style="{{ $td }}text-align:right;white-space:nowrap;">{{ $item['total'] }}</td>
</tr>
@endforeach
</table>

{{-- Prices --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:16px;">
<tr>
<td style="{{ $label }}">{{ $l['label_subtotal'] }}</td>
<td style="{{ $value }}text-align:right;">{{ $amounts['subtotal'] }}</td>
</tr>
@if ($amounts['discount'])
<tr>
<td style="{{ $label }}">{{ $l['label_discount'] }}{{ $order->coupon ? ' (' . $order->coupon->code . ')' : '' }}</td>
<td style="{{ $value }}text-align:right;">{{ $amounts['discount'] }}</td>
</tr>
@endif
<tr>
<td style="{{ $label }}">{{ $l['label_shipping'] }}{{ $order->shippingMethod ? ' – ' . $order->shippingMethod->name : '' }}</td>
<td style="{{ $value }}text-align:right;">{{ $amounts['shipping'] }}</td>
</tr>
@if ($order->paymentMethod)
<tr>
<td style="{{ $label }}">{{ $l['label_payment'] }}</td>
<td style="{{ $value }}text-align:right;">{{ $order->paymentMethod->name }}</td>
</tr>
@endif
<tr>
<td style="{{ $label }}color:#18181b;">{{ $l['label_total'] }}</td>
<td style="{{ $value }}text-align:right;font-size:15px;font-weight:700;">{{ $amounts['total'] }}</td>
</tr>
<tr>
<td style="{{ $label }}border-bottom:0;font-weight:400;">{{ $l['label_vat'] }}</td>
<td style="{{ $value }}border-bottom:0;text-align:right;color:#52525b;">{{ $amounts['vat'] }}</td>
</tr>
</table>

{{-- Delivery address + contact --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:24px;">
<tr>
<td style="{{ $label }}">{{ $l['label_delivery'] }}</td>
<td style="{{ $value }}">
{{ $contact['full_name'] }}@if ($contact['company'])<br>{{ $contact['company'] }}@endif
<br>{{ $order->shipping_address }}
<br>{{ trim($order->shipping_postal_code . ' ' . $order->shipping_city) }}
@if ($order->shipping_country)<br>{{ $order->shipping_country }}@endif
</td>
</tr>
<tr>
<td style="{{ $label }}{{ $order->notes ? '' : 'border-bottom:0;' }}">{{ $l['label_contact'] }}</td>
<td style="{{ $value }}{{ $order->notes ? '' : 'border-bottom:0;' }}">
{{ $contact['email'] }}@if ($contact['phone'])<br>{{ $contact['phone'] }}@endif
</td>
</tr>
@if ($order->notes)
<tr>
<td style="{{ $label }}border-bottom:0;">{{ $l['label_notes'] }}</td>
<td style="{{ $value }}border-bottom:0;white-space:pre-line;">{{ $order->notes }}</td>
</tr>
@endif
</table>

{{-- Right of withdrawal + terms and conditions --}}
<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#52525b;">{{ $l['withdrawal_info'] }}</p>
<p style="margin:0 0 20px;font-size:13px;line-height:1.6;">
<a href="{{ $tosUrl }}" style="color:#2563eb;text-decoration:underline;">{{ $l['terms_link'] }}</a>
</p>

<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">{{ $tpl['outro'] }}</p>
@endsection
