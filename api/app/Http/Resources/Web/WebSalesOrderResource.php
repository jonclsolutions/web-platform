<?php
/**
 * @file WebSalesOrderResource.php
 * @path app/Http/Resources/Web/WebSalesOrderResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for sales orders linked to leads.
 *
 * @refactor-note (2026-08) Odstraněna jednosouborová pole `attachment_path`/`attachment_url`
 * - nahrazeno `attachments` kolekcí (viz WebAttachment.php/WebAttachmentResource.php),
 * podporující až 10 příloh na jednu realizaci místo jedné.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms WebSalesOrder model data, resolving attachment collection and optional lead relationship.
 */
class WebSalesOrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'lead_id'           => $this->lead_id,
            'salesman_name'     => $this->salesman_name,
            'ico'               => $this->ico,
            'client_name'       => $this->client_name,
            'client_address'    => $this->client_address,
            'client_phone'      => $this->client_phone,
            'client_email'      => $this->client_email,
            'order_description' => $this->order_description,
            'attachments'       => WebAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'        => $this->updated_at?->format('Y-m-d H:i:s'),
            'lead'              => new WebSalesLeadResource($this->whenLoaded('lead')),
        ];
    }
}