<?php
/**
 * @file WebSalesLeadResource.php
 * @path app/Http/Resources/Web/WebSalesLeadResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for sales leads.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms WebSalesLead model data into a structured format for sales tracking and CRM integration.
 */
class WebSalesLeadResource extends JsonResource
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
            'id'                 => $this->id,
            'user_id'            => $this->user_id,
            'salesman_name'      => $this->salesman_name,
            'salesman'           => [
                'id'   => $this->user_id,
                'name' => $this->salesman_name,
            ],
            'subject_name'       => $this->subject_name,
            'first_contact_date' => $this->first_contact_date?->format('Y-m-d'),
            'contact_person'     => $this->contact_person,
            'contact_email'      => $this->contact_email,
            'contact_phone'      => $this->contact_phone,
            'contact_other'      => $this->contact_other,
            'location'           => $this->location,
            'source_channel'     => $this->source_channel,
            'source_url'         => $this->source_url,
            'description'        => $this->description,
            'priority'           => $this->priority ?? 'Neutrální',
            'status'             => $this->status ?? 'nové',
            'last_contact_date'  => $this->last_contact_date?->format('Y-m-d'),
            'next_step'          => $this->next_step,
            'rejection_reason'   => $this->rejection_reason,
            'created_at'         => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'         => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'         => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}