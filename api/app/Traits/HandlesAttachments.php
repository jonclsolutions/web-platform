<?php
/**
 * @file HandlesAttachments.php
 * @path app/Traits/HandlesAttachments.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Storing and deleting file attachments, reusable for any model with a
 * `morphMany(CoreAttachment::class, 'attachable')` relation.
 */

namespace App\Traits;

use App\Models\Core\CoreAttachment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

trait HandlesAttachments
{
    /**
     * @description Stores every uploaded file of the request field as a CoreAttachment of $model.
     * @param Request $request
     * @param Model $model Model with the morphMany('attachments') relation.
     * @param string $folder Subfolder in `storage/app/{$disk}/{folder}`.
     * @param string $fileField Request field (default 'attachments').
     * @param string $disk Target disk - 'private' (default) for sensitive attachments,
     *   'public' only for content meant to be publicly reachable.
     * @return void
     */
    protected function storeAttachments(Request $request, Model $model, string $folder, string $fileField = 'attachments', string $disk = 'private'): void
    {
        if (!$request->hasFile($fileField)) {
            return;
        }

        foreach ($request->file($fileField) as $file) {
            if (!$file || !$file->isValid()) {
                continue;
            }

            $path = $file->store($folder, $disk);

            $model->attachments()->create([
                'disk'              => $disk,
                'path'              => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type'         => $file->getClientMimeType(),
                'size_bytes'        => $file->getSize(),
            ]);
        }
    }

    /**
     * @description Stores EXACTLY ONE uploaded file as a CoreAttachment of $model and replaces
     *              any earlier attachment (deleted from the disk and the database) - for
     *              entities with at most one file (WebJobApplication::cv_file).
     * @param Request $request
     * @param Model $model Model with the morphMany('attachments') relation.
     * @param string $folder Subfolder in `storage/app/{$disk}/{folder}`.
     * @param string $fileField Request field of the single file (e.g. 'cv_file', 'attachment').
     * @param string $disk Target disk - 'private' (default).
     * @return void
     */
    protected function storeSingleAttachment(Request $request, Model $model, string $folder, string $fileField, string $disk = 'private'): void
    {
        if (!$request->hasFile($fileField)) {
            return;
        }

        $file = $request->file($fileField);

        if (!$file || !$file->isValid()) {
            return;
        }

        // "At most one file" is enforced here - a new attachment always replaces the previous one
        // (file and database row), they never pile up.
        $this->deleteAllAttachments($model);

        $path = $file->store($folder, $disk);

        $model->attachments()->create([
            'disk'              => $disk,
            'path'              => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type'         => $file->getClientMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);
    }

    /**
     * @description Deletes every attachment of the model (file and database row) - used when the
     * entity is force-deleted or its single file is replaced. Reads `$attachment->disk` per row, so
     * 'public' and 'private' attachments both work. A model with a legacy single-file column
     * (`LEGACY_FILE_COLUMN`, e.g. a CV uploaded before the attachments table) loses that file too, so
     * no file without its record stays on the disk.
     * @param Model $model Model with the morphMany('attachments') relation.
     * @return void
     */
    protected function deleteAllAttachments(Model $model): void
    {
        foreach ($model->attachments as $attachment) {
            \Illuminate\Support\Facades\Storage::disk($attachment->disk)->delete($attachment->path);
            $attachment->delete();
        }

        $legacy = defined($model::class . '::LEGACY_FILE_COLUMN') ? $model::LEGACY_FILE_COLUMN : null;
        if ($legacy && $model->{$legacy}) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($model->{$legacy});
            $model->forceFill([$legacy => null])->saveQuietly();
        }
    }

    /**
     * @description Deletes the SELECTED attachments by ID (not all) - removing single existing
     * attachments on update. Scoped to `$model` through `$model->attachments()`: IDs of other
     * models are not found and silently ignored.
     * @param Model $model Model with the morphMany('attachments') relation.
     * @param array $ids IDs of the attachments to remove (file and database row).
     * @return void
     */
    protected function deleteAttachmentsByIds(Model $model, array $ids): void
    {
        if (empty($ids)) {
            return;
        }

        $attachments = $model->attachments()->whereIn('id', $ids)->get();

        foreach ($attachments as $attachment) {
            \Illuminate\Support\Facades\Storage::disk($attachment->disk)->delete($attachment->path);
            $attachment->delete();
        }
    }
}