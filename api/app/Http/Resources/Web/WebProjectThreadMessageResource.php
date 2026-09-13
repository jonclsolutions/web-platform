<?php
/**
 * @file WebProjectThreadMessageResource.php
 * @path app/Http/Resources/Web/WebProjectThreadMessageResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description JSON shape for a single project thread message. `author_label` may
 * be `null` for customer messages by design - see `WebProjectThreadMessage` model
 * header. Frontend resolves the display label from `author_type` when `null`.
 * @refactor-note (2026-09-11) BACKLOG "vlákna přijímají přílohy": `attachments`
 * doplněny přes sdílený `WebAttachmentResource` (signed download/view URLs) - stejný
 * vzor jako `WebRawRequestCommissionResource`. `whenLoaded()` guard - controllery
 * MUSÍ eager-loadovat `messages.attachments`, jinak se pole v odpovědi vůbec neobjeví.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectThreadMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'author_type'  => $this->author_type,
            'author_label' => $this->author_label,
            'body'         => $this->body,
            'attachments'  => WebAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at'   => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}