<?php
/**
 * @file CoreAttachment.php
 * @path app/Models/Core/CoreAttachment.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Universal (polymorphic) attachment of the platform, reusable by every application
 * (e.g. inquiries, orders, job applications, project portal messages). `attachable_type` holds
 * the morph alias of the owning model (AppManifest::morphMap()), so the owning class may move.
 * @note Only `created_at` (no `updated_at`) - an attachment is never edited after the upload,
 * only added / deleted.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CoreAttachment extends Model
{
    const UPDATED_AT = null;

    /** @var string The table keeps its original name. */
    protected $table = 'core_attachments';

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['original_filename'];

    protected $fillable = [
        'disk',
        'path',
        'original_filename',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'created_at' => 'datetime',
    ];

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }
}