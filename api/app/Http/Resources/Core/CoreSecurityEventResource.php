<?php
/**
 * @file CoreSecurityEventResource.php
 * @path app/Http/Resources/Core/CoreSecurityEventResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description JSON reprezentace bezpečnostního eventu pro admin UI.
 */

namespace App\Http\Resources\Core;

use Illuminate\Http\Resources\Json\JsonResource;

class CoreSecurityEventResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'event_type'    => $this->event_type,
            'severity'      => $this->severity,
            'ip_address'    => $this->ip_address,
            'user_agent'    => $this->user_agent,
            'route'         => $this->route,
            'method'        => $this->method,
            'user_id'       => $this->user_id,
            'occurrences'   => $this->occurrences,
            'status'        => $this->status,
            'notes'         => $this->notes,
            'context_data'  => $this->context_data,
            'first_seen_at' => $this->first_seen_at,
            'last_seen_at'  => $this->last_seen_at,
        ];
    }
}