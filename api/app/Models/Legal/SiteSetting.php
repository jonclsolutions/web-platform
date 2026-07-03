<?php

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected $table = 'legal_site_settings';

    protected $fillable = [
        'company_name',
        'ico',
        'dic',
        'brand_tagline',
        'brand_tagline_i18n',
        'copyright_text',
        'copyright_text_i18n',
        'contact_email',
        'contact_phone',
        'address',
        'footer_text',
        'logo_path',
    ];

    /**
     * `brand_tagline_i18n` a `copyright_text_i18n` jsou v DB sloupce
     * typu JSON s objektem { "cz": "...", "en": "...", ... }.
     * Cast 'array' zajistí automatický encode/decode.
     */
    protected $casts = [
        'brand_tagline_i18n'  => 'array',
        'copyright_text_i18n' => 'array',
    ];
}