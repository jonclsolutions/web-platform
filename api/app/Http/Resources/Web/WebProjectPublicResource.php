<?php
/**
 * @file WebProjectPublicResource.php
 * @path app/Http/Resources/Web/WebProjectPublicResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description PUBLIC/customer-facing project view - deliberately narrower than
 * WebProjectResource: no `access_token`/`lead_id`/`order_id`/internal FKs, nothing
 * that could reveal internal CRM structure to the end customer.
 * @refactor-note (2026-09-11) BACKLOG "project portal - odhad termínu dokončení":
 * `estimated_completion_from`/`estimated_completion_to` doplněny - customer-facing
 * pole, zákazník je má vidět (rozptyl, ne pevný termín - viz WebProject model).
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectPublicResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                        => $this->id,
            'name'                      => $this->name,
            'description'               => $this->description,
            'platform'                  => $this->platform,
            'project_lead'              => $this->project_lead,
            'contact_phone'             => $this->contact_phone,
            'contact_email'             => $this->contact_email,
            'technologies'              => $this->technologies,
            'estimated_completion_from' => $this->estimated_completion_from?->format('Y-m-d'),
            'estimated_completion_to'   => $this->estimated_completion_to?->format('Y-m-d'),
            'checkpoints'               => WebProjectCheckpointResource::collection($this->whenLoaded('checkpoints')),
        ];
    }
}