<?php
/**
 * @file WebSalesOrderResource.php
 * @path app/Http/Resources/Web/WebSalesOrderResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for sales orders linked to leads.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms WebSalesOrder model data, resolving file storage URLs and optional lead relationship.
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
            'attachment_path'   => $this->attachment_path,
            'attachment_url'    => $this->attachment_path ? asset('storage/' . $this->attachment_path) : null,
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'        => $this->updated_at?->format('Y-m-d H:i:s'),
            'lead'              => new WebSalesLeadResource($this->whenLoaded('lead')),
        ];
    }
}