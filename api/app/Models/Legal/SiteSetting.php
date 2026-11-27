<?php
/**
 * @file SiteSetting.php
 * @path app/Models/Legal/SiteSetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Model for legal and corporate site configuration.
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores business-critical information and site-wide legal settings, including i18n support.
 * @note Only what belongs to the company as a whole (2026-11): the copyright line and the footer
 *   text are texts of the applications (`footer.copyright_text` of Texty webu / Texty e-shopu).
 *
 * @property string $company_name The registered business name.
 * @property string $ico The company identification number.
 * @property string $dic The tax identification number.
 * @property string|null $google_analytics_id GA4 Measurement ID (format "G-XXXXXXXXXX").
 * @property array $brand_tagline_i18n Internationalized brand taglines.
 * @property array<int, string>|null $hidden_fields Keys of the switched-off fields (HIDEABLE_FIELDS).
 */
class SiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'legal_site_settings';

    /** @var null The table has no created_at column. */
    const CREATED_AT = null;

    /**
     * @var array<string, array<int, string>> Field that can be switched off => the columns it
     *   covers (an i18n field has its translation column too). company_name and contact_email
     *   are not here: they are always required (the e-mails use them).
     */
    public const HIDEABLE_FIELDS = [
        'brand_tagline'       => ['brand_tagline', 'brand_tagline_i18n'],
        'ico'                 => ['ico'],
        'dic'                 => ['dic'],
        'google_analytics_id' => ['google_analytics_id'],
        'contact_phone'       => ['contact_phone'],
        'address'             => ['address'],
    ];

    /**
     * @var array<string, string> Field shown on the public pages per language => its translation
     *   column. A switched-on field missing in a language shows 'Cannot load text' there and the
     *   language is not complete (CompanyTextsMissing, LanguageCompleteness).
     */
    public const I18N_FIELDS = [
        'brand_tagline' => 'brand_tagline_i18n',
    ];

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
        'contact_email',
        'contact_phone',
        'address',
        'logo_path',
        'hidden_fields',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'brand_tagline_i18n'  => 'array',
        'hidden_fields'       => 'array',
    ];

    /**
     * @description Whether a field of HIDEABLE_FIELDS is switched off.
     * @param string $field Field key (e.g. 'dic').
     * @return bool True when the admin switched the field off.
     */
    public function isFieldHidden(string $field): bool
    {
        return in_array($field, $this->hidden_fields ?? [], true);
    }

    /**
     * @description The row for the public pages and e-mails: every column of a switched-off
     *   field is null, so nothing hidden ever leaves the API (a switched-off GA ID does not
     *   start Google Analytics). `hidden_fields` itself is not sent.
     * @return array<string, mixed> Attributes of the row.
     */
    public function toPublicArray(): array
    {
        $data = $this->toArray();
        foreach (self::HIDEABLE_FIELDS as $field => $columns) {
            if ($this->isFieldHidden($field)) {
                foreach ($columns as $column) {
                    $data[$column] = null;
                }
            }
        }
        unset($data['hidden_fields']);

        return $data;
    }
}