<?php
/**
 * @file WebReference.php
 * @path app/Apps/Web/Models/WebReference.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Reference (delivered project) of the public website: the row of the list (name,
 * year, client) and the detail (category, scope, role, description, key features, technology
 * stack, result and an optional image), texts per language; managed in the admin
 * (web/edit-website, tab References).
 * @note Texts per language are JSON objects `{ lang: text }`; a language without text has no key
 * (see App\Support\I18n\I18nText). Year and client are the same in every language.
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int                   $id
 * @property array<string, string> $category_i18n    Category per language code (free text, optional).
 * @property string|null           $duration         Year / period of the project.
 * @property string|null           $client           Client.
 * @property array<string, string> $name_i18n        Name per language code.
 * @property array<string, string> $size_i18n        Scope per language code (optional).
 * @property array<string, string> $role_i18n        Our role per language code (optional).
 * @property array<string, string> $description_i18n Description per language code (plain text).
 * @property array<string, string> $result_i18n      Result per language code (optional, plain text).
 * @property string|null           $image_path       Image on the public disk (WebReferenceImage).
 * @property bool                  $is_active        Shown on the public website.
 * @property int                   $sort_order       Position in the list.
 */
class WebReference extends Model
{
    /** @var string Table of the model. */
    protected $table = 'web_references';

    /** @var array<int, string> The attributes that are mass assignable (image_path only by WebReferenceImage). */
    protected $fillable = ['category_i18n', 'duration', 'client', 'name_i18n', 'size_i18n', 'role_i18n', 'description_i18n', 'result_i18n', 'is_active', 'sort_order'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'category_i18n' => 'array',
        'name_i18n' => 'array',
        'size_i18n' => 'array',
        'role_i18n' => 'array',
        'description_i18n' => 'array',
        'result_i18n' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * @description Key features in their order.
     * @return HasMany<WebReferenceFeature>
     */
    public function features(): HasMany
    {
        return $this->hasMany(WebReferenceFeature::class, 'reference_id')->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @description Technology stack in its order.
     * @return HasMany<WebReferenceStack>
     */
    public function stack(): HasMany
    {
        return $this->hasMany(WebReferenceStack::class, 'reference_id')->orderBy('sort_order')->orderBy('id');
    }
}
