<?php
/**
 * @file WebReferenceFeature.php
 * @path app/Apps/Web/Models/WebReferenceFeature.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One key feature of a reference (WebReference, deleted with it), per language.
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText).
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int                   $id
 * @property int                   $reference_id
 * @property array<string, string> $text_i18n  Feature per language code.
 * @property int                   $sort_order Position inside the reference.
 */
class WebReferenceFeature extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_reference_features';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['reference_id', 'text_i18n', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'text_i18n' => 'array',
        'reference_id' => 'integer',
        'sort_order' => 'integer',
    ];
}
