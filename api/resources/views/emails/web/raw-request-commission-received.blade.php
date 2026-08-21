<!--
    @file: raw-request-commission-received.blade.php
    @path: resources/views/emails/web/raw-request-commission-received.blade.php
    @project: RPSW Web
    @author: RPSW
    @created: 2026
    @description Potvrzení přijetí poptávky (WebRawRequestCommission) - přepracovaný
    vzhled (2026-08-19), stejný vizuální jazyk jako emails/auth/*.blade.php (header
    pruh, karta, sdílená patička s firemním kontaktem). Rekapitulační tabulka
    přestylována do stejné palety (#18181b/#71717a/#ececea) místo generických šedých
    <table border> řádků.
    @refactor-note (2026-08-19v2) Přidán řádek "Přiložené soubory" - jen VÝPIS názvů
    (original_filename), BEZ odkazů ke stažení/náhledu. Záměrně bez odkazu: zákazník
    soubor už má na svém zařízení (sám ho nahrál), odkaz by tak nic nepřidal, jen
    zbytečně rozšiřoval bezpečnostní plochu (e-mail jako méně bezpečný kanál +
    download/view endpoint je veřejný, neautentizovaný). Řádek se vůbec nezobrazí, pokud
    požadavek nemá žádné přílohy.
    @refactor-note (2026-08-19v3) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
    nadpis a úvodní/závěrečná věta ($emailTitle/$emailIntro/$emailOutro) už NEJSOU
    natvrdo v šabloně - dodává je WebRawRequestCommissionReceived::content() přes
    App\Support\Mail\RawRequestEmailTemplate, podle jazyka záznamu
    ($requestCommission->lang). Pozdrav "Dobrý den," zůstává pevný (není součástí
    editovatelného obsahu) - jen samotná úvodní/závěrečná věta je nahraditelná admin
    UI editorem. Rekapitulační tabulka (Souhrn) beze změny - generovaná data, needituje se.
-->
<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Poptávka přijata</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececea;">

<!-- Header pruh -->
<tr>
<td style="background:#18181b;padding:20px 32px;">
<span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;">
{{ $companyName ?? config('app.name') }}
</span>
</td>
</tr>

<!-- Obsah -->
<tr>
<td style="padding:32px;">
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

@include('emails.partials.footer')

</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>