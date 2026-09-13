<?php
/**
 * @file WebProjectThreadResource.php
 * @path app/Http/Resources/Web/WebProjectThreadResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared by BOTH the admin cross-project table (needs `project_name`
 * badge - consultation note 2) AND the customer's per-project thread list (where
 * `project_name` is simply redundant/ignored by the frontend, not a leak - it's the
 * customer's own project).
 * @refactor-note (2026-09-11) BACKLOG "project portal - nepřečtené zprávy":
 * `unread_count` - počet ADMIN zpráv novějších než `customer_last_read_at` (nebo
 * VŠECH admin zpráv, pokud zákazník vlákno ještě nikdy neotevřel - `null`).
 * Záměrně `whenLoaded('messages')` guard - admin's `WebProjectThreadController::index()`
 * NEnačítá `messages` relaci (jen `project:id,name`), takže se pole u admina v
 * odpovědi vůbec neobjeví (nedávalo by smysl - "nepřečteno zákazníkem" je čistě
 * customer-facing koncept). Customer-facing `threadsIndex()`/`threadShow()` VŽDY
 * `messages` eager-loadují, takže tam se počítá vždy.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectThreadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                     => $this->id,
            'project_id'             => $this->project_id,
            'project_name'           => $this->whenLoaded('project', fn() => $this->project->name),
            'subject'                => $this->subject,
            'priority'               => $this->priority,
            'status'                 => $this->status,
            'opened_by'              => $this->opened_by,
            'last_message_at'        => $this->last_message_at?->format('Y-m-d H:i:s'),
            'unread_count'           => $this->when($this->relationLoaded('messages'), function () {
                $adminMessages = $this->messages->where('author_type', 'admin');
                if (!$this->customer_last_read_at) {
                    return $adminMessages->count();
                }
                return $adminMessages->filter(
                    fn($msg) => $msg->created_at && $msg->created_at->gt($this->customer_last_read_at)
                )->count();
            }),
            'messages'               => WebProjectThreadMessageResource::collection($this->whenLoaded('messages')),
            'created_at'             => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}