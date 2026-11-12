<?php
/**
 * @file CoreAttachmentResource.php
 * @path app/Http/Resources/Core/CoreAttachmentResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Resource transformation for individual file attachments (CoreAttachment) with
 *   short-lived signed download / view links.
 */

namespace App\Http\Resources\Core;

use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\URL;

class CoreAttachmentResource extends JsonResource
{
    /** @description Lifetime of a signed URL in minutes - links in an API answer expire quickly. */
    private const SIGNED_URL_TTL_MINUTES = 10;

    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'original_filename' => $this->original_filename,
            'mime_type'         => $this->mime_type,
            'size_bytes'        => $this->size_bytes,
            'download_url'      => $this->path ? $this->signedUrl('attachments.download') : null,
            // Only previewable types get a "view" link (AttachmentPolicy) - everything else is
            // download only; the server decides again from the content when serving.
            'view_url'          => $this->path && AttachmentPolicy::isInlineFileName($this->original_filename ?: $this->path)
                ? $this->signedUrl('attachments.view') : null,
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * @description Builds a short-lived signed URL of the route with `path` as its parameter -
     * the same for download and view (only the route name / Content-Disposition differ, see
     * AttachmentDownloadController).
     */
    private function signedUrl(string $routeName): string
    {
        return URL::temporarySignedRoute(
            $routeName,
            now()->addMinutes(self::SIGNED_URL_TTL_MINUTES),
            ['path' => $this->path]
        );
    }
}