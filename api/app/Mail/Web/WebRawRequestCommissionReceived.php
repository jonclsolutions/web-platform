<?php
/**
 * @file WebRawRequestCommissionReceived.php
 * @path app/Mail/Web/WebRawRequestCommissionReceived.php
 * @project RPSW Web
 * @description Confirmation email sent to the customer after submitting a public commission request.
 * @refactor-note (2026-08-19) BACKLOG "hezčí a přehlednější maily": šablona přepracována
 * (viz emails/web/raw-request-commission-received.blade.php) a doplněna o firemní
 * kontakt v patičce - `content()` teď předává `CompanyContactInfo::get()` přes
 * `Content::with()`, stejně jako auth maily (PasswordResetRequested apod.).
 * @refactor-note (2026-08-19v2) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
 * `content()` navíc předává `RawRequestEmailTemplate::forLang($this->requestCommission
 * ->lang)` - nadpis/úvod/závěr podle jazyka, ve kterém zákazník formulář odeslal
 * (`WebRawRequestCommission::lang`, viz refactor-note v hlavičce modelu), s fallbackem
 * na 'cz' a nakonec na hardcoded default, pokud admin pro daný jazyk nic nevyplnil.
 * @refactor-note (2026-08-19v3) BACKLOG "editace předmětu e-mailu": `envelope()` dřív
 * měl natvrdo `'Vaše poptávka byla přijata – ' . $thema`, takže předmět chodil česky
 * bez ohledu na jazyk záznamu. Teď bere `emailSubject` ze stejné
 * `RawRequestEmailTemplate::forLang()` odpovědi jako zbytek obsahu.
 *
 * Výsledek `forLang()` je memoizovaný v `template()` (private property) - `envelope()`
 * i `content()` volají stejnou instanci na tomtéž Mailable objektu, takže bez memoizace
 * by se `WebSiteSetting::first()` zbytečně dotazoval do DB dvakrát na jeden odeslaný mail.
 */

namespace App\Mail\Web;

use App\Models\Web\WebRawRequestCommission;
use App\Support\Mail\CompanyContactInfo;
use App\Support\Mail\RawRequestEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WebRawRequestCommissionReceived extends Mailable
{
use Queueable, SerializesModels;

/** @var array|null Memoizovaný výsledek RawRequestEmailTemplate::forLang() - viz hlavička souboru. */
private ?array $resolvedTemplate = null;

public function __construct(
public WebRawRequestCommission $requestCommission
    ) {}

public function envelope(): Envelope
    {
$tpl = $this->template();

return new Envelope(
subject: $tpl['emailSubject'] . ' – ' . $this->requestCommission->thema,
        );
    }

public function content(): Content
    {
return new Content(
view: 'emails.web.raw-request-commission-received',
with: array_merge(
    CompanyContactInfo::get(),
    $this->template()
),
        );
    }

public function attachments(): array
    {
return [];
    }

/**
 * @description Vrátí (a napoprvé dopočítá) šablonový obsah pro jazyk tohoto záznamu.
 * Memoizace zabrání druhému dotazu do `web_site_settings`, když `envelope()` i
 * `content()` volají tuhle metodu na stejné instanci mailu.
 */
private function template(): array
    {
return $this->resolvedTemplate ??= RawRequestEmailTemplate::forLang($this->requestCommission->lang);
    }
}