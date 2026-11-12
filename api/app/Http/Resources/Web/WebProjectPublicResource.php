<?php
/**
 * @file WebProjectPublicResource.php
 * @path app/Http/Resources/Web/WebProjectPublicResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description PUBLIC/customer-facing project view - deliberately narrower than
 * WebProjectResource: no `access_token`/`lead_id`/`order_id`/internal FKs, nothing
 * that could reveal internal CRM structure to the end customer.
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
            'checkpoints'               => WebProjectCheckpointPublicResource::collection($this->whenLoaded('checkpoints')),
            // The signed-in client account (set by CheckProjectSession / login) - its own data and
            // the settings it may change itself ("My account"), nothing of other accounts.
            'account'                   => $this->when($request->attributes->has('current_project_account'), function () use ($request) {
                $account = $request->attributes->get('current_project_account');

                return [
                    'id'                       => $account->id,
                    'username'                 => $account->username,
                    'display_name'             => $account->display_name,
                    'email'                    => $account->email,
                    'language'                 => $account->language,
                    'notify_replies'           => (bool) $account->notify_replies,
                    'notify_checkpoint_status' => (bool) $account->notify_checkpoint_status,
                    'notify_checkpoint_dates'  => (bool) $account->notify_checkpoint_dates,
                ];
            }),
        ];
    }
}