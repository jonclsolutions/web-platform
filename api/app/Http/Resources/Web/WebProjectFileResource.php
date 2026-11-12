<?php
/**
 * @file WebProjectFileResource.php
 * @path app/Http/Resources/Web/WebProjectFileResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One file of the project's "Files" overview: the attachment (short-lived signed
 *   download / view links of WebAttachmentResource) with the message it came with - thread,
 *   author, time and whether it belongs to an internal note (administration only).
 * @dependencies WebAttachmentResource; the attachment must be loaded with `attachable.thread`.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebProjectFileResource extends JsonResource
{
    /**
     * @description Attachment fields + the context of its message.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $message = $this->attachable;

        return array_merge((new WebAttachmentResource($this->resource))->toArray($request), [
            'thread_id'      => $message?->thread_id,
            'thread_subject' => $message?->thread?->subject,
            'author_type'    => $message?->author_type,
            'author_label'   => $message?->author_label,
            'is_internal'    => (bool) ($message?->is_internal ?? false),
            'message_id'     => $message?->id,
        ]);
    }
}
