<?php
/**
 * @file WebJobApplication.php
 * @path app/Models/Web/WebJobApplication.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing a job application submission.
 * @refactor-note (2026-08-2) Přidán `attachments()` polymorfní vztah - CV se od teď
 *      ukládá přes `web_attachments` (viz HandlesAttachments::storeSingleAttachment())
 *      místo přímo do `cv_path`. `cv_path`/`cv_original_name` sloupce zůstávají v DB
 *      kvůli historickým záznamům nahraným před touto změnou, ale nový upload už do
 *      nich nezapisuje - viz WebJobApplicationController.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @description Manages applicant data, contact details, and resume storage for career opportunities.
 * * @property int $id Unique identifier.
 * @property string $email Candidate email address.
 * @property string|null $cv_path Legacy path to a CV uploaded before the web_attachments refactor.
 */
class WebJobApplication extends Model
{
use HasFactory, SoftDeletes;

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