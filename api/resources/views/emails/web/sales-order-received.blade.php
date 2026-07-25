{{-- resources/views/emails/web/sales-order-received.blade.php --}}
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; color: #222; line-height: 1.5;">

    <h2>Dobrý den{{ $order->client_name ? ', ' . $order->client_name : '' }},</h2>

    <p>děkujeme za Vaši poptávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.</p>

    <h3>Rekapitulace poptávky</h3>

    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 180px;">Jméno / Firma</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{ $order->client_name }}</td>
        </tr>
        @if($order->ico)
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">IČO</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{ $order->ico }}</td>
        </tr>
        @endif
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Kontaktní e-mail</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{ $order->client_email }}</td>
        </tr>
        @if($order->client_phone)
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Telefon</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{ $order->client_phone }}</td>
        </tr>
        @endif
        @if($order->client_address)
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Adresa</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{ $order->client_address }}</td>
        </tr>
        @endif
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Popis poptávky</td>
            <td style="padding: 8px; border: 1px solid #ddd; white-space: pre-line;">{{ $order->order_description }}</td>
        </tr>
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Datum přijetí</td>
            <td style="padding: 8px; border: 1px solid #ddd;">{{ $order->created_at->format('d.m.Y H:i') }}</td>
        </tr>
    </table>

    <p style="margin-top: 24px;">V případě dotazů nás neváhejte kontaktovat.</p>

    <p>S pozdravem,<br>Váš tým</p>

</body>
</html>