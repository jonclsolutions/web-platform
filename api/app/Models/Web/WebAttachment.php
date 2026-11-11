<?php
/**
 * @file WebAttachment.php
 * @path app/Models/Web/WebAttachment.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Universal (polymorphic) attachment, reusable for any entity
 * (WebRawRequestCommission, WebSalesOrder, support tickets, ...).
 * @note Only `created_at` (no `updated_at`) - an attachment is never edited after the upload,
 * only added / deleted.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class WebAttachment extends Model
{
    const UPDATED_AT = null;

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