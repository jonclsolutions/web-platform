<?php
/**
 * @file ProjectFileResource.php
 * @path app/Apps/ProjectPortal/Http/Resources/ProjectFileResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One file of the project's "Files" overview: the attachment (short-lived signed
 *   download / view links of CoreAttachmentResource) with where it came from - `source` thread
 *   (message: thread, author, internal note - administration only), update or approval - its id,
 *   title and author.
 * @dependencies CoreAttachmentResource; loaded by ProjectFiles (`attachable`, a message with its thread).
 */

namespace App\Apps\ProjectPortal\Http\Resources;

use App\Http\Resources\Core\CoreAttachmentResource;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Models\ProjectUpdate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectFileResource extends JsonResource
{
    /**
     * @description Attachment fields + the context of its message.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $source = $this->attachable;
        $base = (new CoreAttachmentResource($this->resource))->toArray($request);

        if ($source instanceof ProjectUpdate || $source instanceof ProjectApproval) {
            $isUpdate = $source instanceof ProjectUpdate;

            return array_merge($base, [
                'source'         => $isUpdate ? 'update' : 'approval',
                'source_id'      => $source->id,
                'source_title'   => $source->title,
                'thread_id'      => null,
                'thread_subject' => null,
                'author_type'    => 'admin',
                'author_label'   => $isUpdate ? $source->author_label : $source->requested_by_label,
                'is_internal'    => false,
                'message_id'     => null,
            ]);
        }

        return array_merge($base, [
            'source'         => 'thread',
            'source_id'      => $source?->thread_id,
            'source_title'   => $source?->thread?->subject,
            'thread_id'      => $source?->thread_id,
            'thread_subject' => $source?->thread?->subject,
            'author_type'    => $source?->author_type,
            'author_label'   => $source?->author_label,
            'is_internal'    => (bool) ($source?->is_internal ?? false),
            'message_id'     => $source?->id,
        ]);
    }
}
