<?php

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

class CoreSiteSetting extends Model
{
    protected $table = 'core_site_settings';

    protected $fillable = [
        'is_shop_active',
        'maintenance_message',
    ];

    protected $casts = [
        'is_shop_active' => 'boolean',
    ];
}