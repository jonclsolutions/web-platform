<?php
/**
 * @file WebKbSection.php
 * @path app/Apps/Web/Models/WebKbSection.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Block of the public knowledge base (/knowledge-base): heading, text, optional
 * sub-blocks (WebKbItem) and an optional image shown at the end of the block; one row with
 * `is_intro` is the introduction of the page (main heading + first text, no sub-blocks, no image).
 * Managed in the admin (web/edit-website, tab Knowledge base).
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText). Texts are plain text, never HTML.
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int                   $id
 * @property bool                  $is_intro     The introduction of the page.
 * @property array<string, string> $heading_i18n Heading per language code.
 * @property array<string, string> $text_i18n    Text per language code (plain text).
 * @property string|null           $image_path   Image on the public disk (WebKbImage).
 * @property bool                  $is_active    Shown on the public website.
 * @property int                   $sort_order   Position on the page (the introduction is first).
 */
class WebKbSection extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_kb_sections';

    /** @var array<int, string> The attributes that are mass assignable (image_path only by WebKbImage). */
    protected $fillable = ['is_intro', 'heading_i18n', 'text_i18n', 'is_active', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'is_intro' => 'boolean',
        'heading_i18n' => 'array',
        'text_i18n' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * @description Sub-blocks in their order.
     * @return HasMany<WebKbItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(WebKbItem::class, 'section_id')->orderBy('sort_order')->orderBy('id');
    }
}
