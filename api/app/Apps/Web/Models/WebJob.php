<?php
/**
 * @file WebJob.php
 * @path app/Apps/Web/Models/WebJob.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Open position of the public website (Careers): the preview of the list (title, short
 * description) and the detail (type, location and the blocks of WebJobSection), per language;
 * managed in the admin (web/edit-website, tab Jobs).
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText).
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int                   $id
 * @property string                $slug          URL of the detail (/jobs/{slug}), unique.
 * @property array<string, string> $title_i18n    Title per language code.
 * @property array<string, string> $summary_i18n  Short description of the list per language code.
 * @property array<string, string> $type_i18n     Type of the job (e.g. "Full-time") per language code.
 * @property array<string, string> $location_i18n Place of work per language code.
 * @property bool                  $is_active     Shown on the public website.
 * @property int                   $sort_order    Position in the list.
 */
class WebJob extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_jobs';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['slug', 'title_i18n', 'summary_i18n', 'type_i18n', 'location_i18n', 'is_active', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'title_i18n' => 'array',
        'summary_i18n' => 'array',
        'type_i18n' => 'array',
        'location_i18n' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * @description Blocks of the detail in their order.
     * @return HasMany<WebJobSection>
     */
    public function sections(): HasMany
    {
        return $this->hasMany(WebJobSection::class, 'job_id')->orderBy('sort_order')->orderBy('id');
    }
}
