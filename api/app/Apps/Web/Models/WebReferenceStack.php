<?php
/**
 * @file WebReferenceStack.php
 * @path app/Apps/Web/Models/WebReferenceStack.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One row of the technology stack of a reference (WebReference, deleted with it):
 * label (e.g. "Frontend") and value (e.g. "Angular, TypeScript"), per language.
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText).
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int                   $id
 * @property int                   $reference_id
 * @property array<string, string> $label_i18n Label per language code.
 * @property array<string, string> $value_i18n Value per language code.
 * @property int                   $sort_order Position inside the reference.
 */
class WebReferenceStack extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_reference_stack';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['reference_id', 'label_i18n', 'value_i18n', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'label_i18n' => 'array',
        'value_i18n' => 'array',
        'reference_id' => 'integer',
        'sort_order' => 'integer',
    ];
}
