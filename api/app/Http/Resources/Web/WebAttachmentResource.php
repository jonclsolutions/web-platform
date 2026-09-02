<?php
/**
 * @file WebAttachmentResource.php
 * @path app/Http/Resources/Web/WebAttachmentResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for individual file attachments.
 *
 * @refactor-note (2026-08-31) BACKLOG "privátní úložiště citlivých příloh":
 * `download_url`/`view_url` teď generujeme jako KRÁTKODOBĚ PODEPSANÉ (10 min TTL)
 * Laravel signed URL (`URL::temporarySignedRoute`), místo prostého `url('/api/...')`
 * odkazu bez jakékoliv ochrany. Důvod: přílohy se dnes typicky ukládají na `private`
 * disk (viz HandlesAttachments), který je fyzicky nedosažitelný přímo přes webserver -
 * jediná cesta k souboru je přes `AttachmentDownloadController` (dřív
 * `PublicFileDownloadController`), jehož routy vyžadují platný podpis (`signed`
 * middleware, viz routes/api.php). Autorizace tak probíhá NEPŘÍMO: tenhle resource se
 * vždy vrací až jako součást odpovědi z autentizovaného a permission-gated endpointu
 * (`GET web/raw_request_commissions/{id}` apod.) - v okamžiku, kdy je tahle URL
 * vygenerovaná, uživatel už prošel kontrolou oprávnění. 10minutová expirace omezuje
 * riziko sdílení/prosáknutí odkazu (screenshot, network log) - po vypršení je odkaz
 * mrtvý, admin si detail záznamu prostě znovu otevře pro čerstvou URL.
 * `url` pole (přímý storage odkaz) ZŮSTÁVÁ zachováno pro zpětnou kompatibilitu, ale u
 * příloh na `private` disku bude fakticky nefunkční (žádný symlink) - frontend musí
 * vždy používat `download_url`/`view_url`.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\URL;

class WebAttachmentResource extends JsonResource
{
    /** @description TTL podepsané URL v minutách - viz refactor-note v hlavičce souboru. */
    private const SIGNED_URL_TTL_MINUTES = 10;

    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'original_filename' => $this->original_filename,
            'mime_type'         => $this->mime_type,
            'size_bytes'        => $this->size_bytes,
            'url'               => $this->url,
            'download_url'      => $this->path ? $this->signedUrl('attachments.download') : null,
            'view_url'          => $this->path ? $this->signedUrl('attachments.view') : null,
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * @description Vygeneruje krátkodobě podepsanou URL pro daný route name, s `path`
     * jako route parametrem - stejný pro download i view (liší se jen route name/
     * Content-Disposition, viz AttachmentDownloadController).
     */
    private function signedUrl(string $routeName): string
    {
        return URL::temporarySignedRoute(
            $routeName,
            now()->addMinutes(self::SIGNED_URL_TTL_MINUTES),
            ['path' => $this->path]
        );
    }
}