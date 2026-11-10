<?php
/**
 * @file WebFaqCategory.php
 * @path app/Models/Web/WebFaqCategory.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Category of the FAQ of the public website (the tabs above the questions), name per
 * language; managed in the admin (web/edit-website, tab FAQ).
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int                   $id
 * @property array<string, string> $name_i18n  Name per language code.
 * @property int                   $sort_order Position of the tab (0 = first).
 */
class WebFaqCategory extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_faq_categories';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['name_i18n', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'name_i18n' => 'array',
        'sort_order' => 'integer',
    ];

    /**
     * @description Questions of the category in their order.
     * @return HasMany<WebFaqItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(WebFaqItem::class, 'category_id')->orderBy('sort_order')->orderBy('id');
    }
}
