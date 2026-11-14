<?php
/**
 * @file AuditLogResource.php
 * @path app/Http/Resources/Core/AuditLogResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description API shape of one row of any audit log (AuditLog: core_logs and the log of each
 *   application) - the same fields for every log page of the admin.
 * @dependencies AuditLog.
 */

namespace App\Http\Resources\Core;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Core\AuditLog
 */
class AuditLogResource extends JsonResource
{
    /**
     * @description Columns of the row; `created_at` as ISO 8601.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                   => $this->id,
            'origin'               => $this->origin,
            'event_type'           => $this->event_type,
            'module'               => $this->module,
            'description'          => $this->description,
            'affected_entity_type' => $this->affected_entity_type,
            'affected_entity_id'   => $this->affected_entity_id,
            'user_id'              => $this->user_id,
            'context_data'         => $this->context_data,
            'user_id_plain'        => $this->user_id_plain,
            'user_plain'           => $this->user_plain,
            'created_at'           => $this->created_at,
        ];
    }
}
