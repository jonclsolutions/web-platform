<?php
/**
 * @file WebFaqItem.php
 * @path app/Models/Web/WebFaqItem.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One question of the FAQ of the public website with its answer, per language; belongs to
 * a category (WebFaqCategory, deleted with it).
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int                   $id
 * @property int                   $category_id
 * @property array<string, string> $question_i18n Question per language code.
 * @property array<string, string> $answer_i18n   Answer per language code (plain text, line breaks kept).
 * @property int                   $sort_order    Position inside the category.
 */
class WebFaqItem extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_faq_items';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['category_id', 'question_i18n', 'answer_i18n', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'question_i18n' => 'array',
        'answer_i18n' => 'array',
        'category_id' => 'integer',
        'sort_order' => 'integer',
    ];

    /**
     * @description Category of the question.
     * @return BelongsTo<WebFaqCategory, WebFaqItem>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(WebFaqCategory::class, 'category_id');
    }
}
