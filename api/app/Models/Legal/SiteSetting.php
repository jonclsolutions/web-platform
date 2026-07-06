<?php
/**
 * @file SiteSetting.php
 * @path app/Models/Legal/SiteSetting.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model for legal and corporate site configuration.
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores business-critical information and site-wide legal settings, including i18n support.
 * 
 * @property string $company_name The registered business name.
 * @property string $ico The company identification number.
 * @property string $dic The tax identification number.
 * @property array $brand_tagline_i18n Internationalized brand taglines.
 * @property array $copyright_text_i18n Internationalized copyright notices.
 */
class SiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'legal_site_settings';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
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
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'brand_tagline_i18n'  => 'array',
        'copyright_text_i18n' => 'array',
    ];
}