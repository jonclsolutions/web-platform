<?php
/**
 * @file CoreSiteSetting.php
 * @path app/Models/Core/CoreSiteSetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for global site configuration settings.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores global application-wide settings like maintenance modes and feature flags.
 * 
 * @property bool $is_shop_active Whether the shopping module is enabled.
 * @property string|null $maintenance_message Message displayed when the site is under maintenance.
 */
class CoreSiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'core_site_settings';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'is_shop_active',
        'maintenance_message',
    ];

    /**
     * @var array<string, string> The attributes that should be cast.
     */
    protected $casts = [
        'is_shop_active' => 'boolean',
    ];
}