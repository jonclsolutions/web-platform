<?php
/**
 * @file WebJobApplication.php
 * @path app/Models/Web/WebJobApplication.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing a job application submission.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * @description Manages applicant data, contact details, and resume storage for career opportunities.
 * * @property int $id Unique identifier.
 * @property string $email Candidate email address.
 * @property string|null $cv_path Path to the stored CV file.
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
}