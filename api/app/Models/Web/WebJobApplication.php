<?php
/**
 * @file WebJobApplication.php
 * @path app/Models/Web/WebJobApplication.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Model representing a job application submission.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @description Manages applicant data, contact details, and resume storage for career opportunities.
 * * @property int $id Unique identifier.
 * @property string $email Candidate email address.
 * @property string|null $cv_path Legacy path to a CV uploaded before the web_attachments refactor.
 */
class WebJobApplication extends Model
{
use SoftDeletes;

    /** @description Column of the legacy single file (public disk) - deleted with the attachments. */
    public const LEGACY_FILE_COLUMN = 'cv_path';

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['first_name', 'last_name', 'email', 'phone', 'message', 'cv_path', 'internal_note'];

/**
     * @var array<int, string> The attributes that are mass assignable.
     */
protected $fillable = [
'first_name',
'last_name',
'email',
'phone',
'position_name',
'message',
'cv_path',
'state',
'internal_note'
    ];

    /**
     * @description Polymorphic relation to the current CV attachment(s).
     *              storeSingleAttachment() guarantees at most one row here.
     * @return MorphMany
     */
    public function attachments(): MorphMany
    {
        return $this->morphMany(WebAttachment::class, 'attachable');
    }
}