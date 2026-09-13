<?php
/**
 * @file WebProjectResource.php
 * @path app/Http/Resources/Web/WebProjectResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description ADMIN-facing project resource.
 * @bugfix-note (2026-08-29e) BACKLOG "stav projektu se nezobrazuje v tabulce/editu":
 * `status` chyběl v `toArray()` výstupu úplně - hodnota se do DB zapisovala
 * (WebProjectController::store()), ale nikdy se nedostala do JSON odpovědi, kterou
 * čte tabulka i edit formulář. Doplněno vedle `visibility`.
 * @refactor-note (2026-09-11) BACKLOG "project portal - odhad termínu dokončení":
 * `estimated_completion_from`/`estimated_completion_to` doplněny - admin je
 * needituje v jiné formě než přes update() formulář, žádná speciální logika.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                         => $this->id,
            'lead_id'                    => $this->lead_id,
            'order_id'                   => $this->order_id,
            'name'                       => $this->name,
            'description'                => $this->description,
            'platform'                   => $this->platform,
            'project_lead'               => $this->project_lead,
            'contact_phone'              => $this->contact_phone,
            'contact_email'              => $this->contact_email,
            'technologies'               => $this->technologies,
            'estimated_completion_from'  => $this->estimated_completion_from?->format('Y-m-d'),
            'estimated_completion_to'    => $this->estimated_completion_to?->format('Y-m-d'),
            'visibility'                 => $this->visibility,
            'status'                     => $this->status,
            'access_token'               => $this->access_token,
            'public_url'                 => rtrim(config('app.frontend_url', $request->getSchemeAndHttpHost()), '/') . "/projects/{$this->access_token}",
            'password_generated_at'      => $this->password_generated_at?->format('Y-m-d H:i:s'),
            'checkpoints_total'          => $this->whenCounted('checkpoints'),
            'checkpoints_done'           => $this->when(isset($this->checkpoints_done_count), $this->checkpoints_done_count),
            'checkpoints'                => WebProjectCheckpointResource::collection($this->whenLoaded('checkpoints')),
            'created_at'                 => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'                 => $this->updated_at?->format('Y-m-d H:i:s'),
            'lead'                       => new WebSalesLeadResource($this->whenLoaded('lead')),
            'order'                      => new WebSalesOrderResource($this->whenLoaded('order')),
        ];
    }
}