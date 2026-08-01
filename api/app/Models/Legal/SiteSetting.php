<?php
/**
 * @file SiteSetting.php
 * @path app/Models/Legal/SiteSetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for legal and corporate site configuration.
 *
 * @refactor-note (2026) Přidán `google_analytics_id` do `$fillable` - bez tohohle by
 * Eloquent při `$settings->update($data)` tiše zahodil hodnotu poslanou z
 * SiteConfigurationController::updateSettings(), i když by request sám o sobě
 * doběhl úspěšně (žádná validační chyba, jen mass-assignment ochrana v tichosti
 * ignoruje neznámé pole).
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores business-critical information and site-wide legal settings, including i18n support.
 * 
 * @property string $company_name The registered business name.
 * @property string $ico The company identification number.
 * @property string $dic The tax identification number.
 * @property string|null $google_analytics_id GA4 Measurement ID (formát "G-XXXXXXXXXX").
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
        'google_analytics_id',
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