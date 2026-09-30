<?php
/**
 * @file PageTitle.php
 * @path app/Models/Legal/PageTitle.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Browser tab title (<title>) of one page (web, e-shop or the whole
 *              administration),
 *              stored per language. Rows are created by SQL (see
 *              2026-09-30_legal_page_titles.sql), the admin only edits the texts.
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

/**
 * @description One public page and its tab title in every language.
 * @note The pair `area` + `page_key` equals the Angular route `title` ("web.home").
 *       Rows are never created or deleted from the admin – only `title_i18n` is
 *       mass-assignable, so a request can not rename or re-key a page.
 *
 * @property int                   $id
 * @property string                $area        'web' | 'shop' | 'admin'
 * @property string                $page_key    Stable page identifier (e.g. 'services').
 * @property string                $route_path  Informative URL shown in admin.
 * @property array<string, string> $title_i18n  Tab title per language code.
 * @property int                   $sort_order
 */
class PageTitle extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'legal_page_titles';

    /**
     * @var string|null The table has only `updated_at`.
     */
    const CREATED_AT = null;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'title_i18n',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'title_i18n' => 'array',
        'sort_order' => 'integer',
    ];
}