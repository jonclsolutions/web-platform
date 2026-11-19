<?php
/**
 * @file WebKbItem.php
 * @path app/Apps/Web/Models/WebKbItem.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sub-block of a block of the public knowledge base (WebKbSection): a smaller heading
 * and its text, per language.
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int                   $id
 * @property int                   $section_id Block of the sub-block.
 * @property array<string, string> $title_i18n Heading per language code.
 * @property array<string, string> $text_i18n  Text per language code (plain text).
 * @property int                   $sort_order Position in the block.
 */
class WebKbItem extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_kb_items';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['section_id', 'title_i18n', 'text_i18n', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'title_i18n' => 'array',
        'text_i18n' => 'array',
        'sort_order' => 'integer',
    ];

    /**
     * @description Block of the sub-block.
     * @return BelongsTo<WebKbSection, WebKbItem>
     */
    public function section(): BelongsTo
    {
        return $this->belongsTo(WebKbSection::class, 'section_id');
    }
}
