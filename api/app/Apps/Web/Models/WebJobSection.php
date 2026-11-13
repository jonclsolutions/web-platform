<?php
/**
 * @file WebJobSection.php
 * @path app/Apps/Web/Models/WebJobSection.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One block of the detail of an open position (WebJob, deleted with it): an optional
 * heading and the text (plain text, line breaks and bullet lines kept), per language.
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText).
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int                   $id
 * @property int                   $job_id
 * @property array<string, string> $heading_i18n Heading per language code (optional).
 * @property array<string, string> $body_i18n    Text per language code.
 * @property int                   $sort_order   Position inside the detail.
 */
class WebJobSection extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_job_sections';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['job_id', 'heading_i18n', 'body_i18n', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'heading_i18n' => 'array',
        'body_i18n' => 'array',
        'job_id' => 'integer',
        'sort_order' => 'integer',
    ];

    /**
     * @description Position the block belongs to.
     * @return BelongsTo<WebJob, WebJobSection>
     */
    public function job(): BelongsTo
    {
        return $this->belongsTo(WebJob::class, 'job_id');
    }
}
