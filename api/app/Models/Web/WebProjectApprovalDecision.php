<?php
/**
 * @file WebProjectApprovalDecision.php
 * @path app/Models/Web/WebProjectApprovalDecision.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One decision of the client on an approval request (approved / changes requested)
 *   with its comment, the account and the time - kept even when the account is removed (the
 *   stored name stays). Never changed after it was written.
 * @dependencies WebProjectApproval, WebProjectAccount
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebProjectApprovalDecision extends Model
{
    public const UPDATED_AT = null;

    /** @description The comment and the name are the client's text - masked in the audit log. */
    public const AUDIT_MASKED = ['comment', 'author_label'];

    protected $fillable = ['approval_id', 'decision', 'comment', 'account_id', 'author_label'];

    public function approval(): BelongsTo
    {
        return $this->belongsTo(WebProjectApproval::class, 'approval_id');
    }
}
