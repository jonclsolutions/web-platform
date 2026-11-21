{{--
    @file payment-details.blade.php
    @path app/Apps/Shop/Resources/views/emails/partials/payment-details.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Payment details of a bank transfer (ShopPaymentMethod::paymentDetails()): account,
    IBAN, SWIFT / BIC, variable symbol and the amount - in the order confirmation and in the payment
    reminder (audit B-04). Nothing without details. Expects $tpl (texts), $paymentDetails
    (label key => value) and $total (formatted amount).
--}}
@if (!empty($paymentDetails))
@php
    $l = $tpl['labels'];
    $label = 'padding:10px 16px;background:#fafafa;font-size:13px;font-weight:600;color:#52525b;width:38%;border-bottom:1px solid #ececea;';
    $value = 'padding:10px 16px;font-size:13px;color:#18181b;border-bottom:1px solid #ececea;font-family:Consolas,Menlo,monospace;';
@endphp
<p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#71717a;">{{ $l['payment_details_header'] }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececea;border-radius:10px;overflow:hidden;margin-bottom:24px;">
@foreach ($paymentDetails as $key => $detail)
<tr>
<td style="{{ $label }}">{{ $l[$key] }}</td>
<td style="{{ $value }}">{{ $detail }}</td>
</tr>
@endforeach
<tr>
<td style="{{ $label }}border-bottom:0;">{{ $l['label_total'] }}</td>
<td style="{{ $value }}border-bottom:0;font-weight:700;">{{ $total }}</td>
</tr>
</table>
@endif
