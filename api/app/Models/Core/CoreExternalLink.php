<?php
/**
 * @file CoreExternalLink.php
 * @path app/Models/Core/CoreExternalLink.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description External link shown in the admin (analytics dashboard, webmail, Search Console,
 * ...) - plain links, no live statistics.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * @property int $user_id Owner - only this user sees and manages the link.
 * @property string $name Display name of the link.
 * @property string $url Target URL.
 */
class CoreExternalLink extends Model
{
    use SoftDeletes;

    protected $table = 'core_external_links';

    protected $fillable = [
        'user_id',
        'name',
        'url',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}