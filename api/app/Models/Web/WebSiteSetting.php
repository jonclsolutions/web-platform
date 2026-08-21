<?php
/**
 * @file WebSiteSetting.php
 * @path app/Models/Web/WebSiteSetting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model for public-web-specific global configuration - web maintenance
 * mode (active flag + visitor-facing message) a editovatelná i18n šablona
 * potvrzovacího e-mailu pro WebRawRequestCommission (nadpis/úvod/závěr, viz
 * refactor-note 2026-08-19 níže).
 *
 * @refactor-note (2026-08-15) Extracted from `App\Models\Core\CoreSiteSetting`
 * (`core_site_settings` table), který je nyní zcela zrušen. Web maintenance je
 * Web-doménová záležitost, ne Core-doménová - zrcadlí dřívější extrakci shop
 * maintenance do `App\Models\Shop\ShopSiteSetting`. Po přesunu obou sekcí
 * `core_site_settings` nemělo nic k obsluze a bylo smazáno, ne ponecháno jako
 * mrtvá infrastruktura.
 *
 * @refactor-note (2026-08-19) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
 * přidány 3 i18n sloupce (`raw_request_email_title_i18n`/`_intro_i18n`/`_outro_i18n`) -
 * stejný `longtext` + `CHECK (json_valid(...))` vzor jako `brand_tagline_i18n` v
 * `legal_site_settings`. Doménově zůstávají v téhle (Web) tabulce, ne v Legal
 * `SiteSetting`, protože jde o obsah e-mailu pro Web zdroj
 * (`web_raw_request_commissions`), ne o firemní/legal údaje. Fallback logika
 * (chybějící/prázdný text pro daný jazyk -> 'cz' -> hardcoded default) řeší
 * `App\Support\Mail\RawRequestEmailTemplate`, ne tento model.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores the public web's global availability state (maintenance mode),
 * the message shown to visitors while it is disabled, and the editable per-language
 * confirmation email template for raw commission requests.
 *
 * @property bool $is_web_active Whether the public web is enabled.
 * @property string|null $web_maintenance_message Message displayed to visitors when disabled.
 * @property array|null $raw_request_email_title_i18n Email heading, keyed by language code.
 * @property array|null $raw_request_email_intro_i18n Email intro paragraph, keyed by language code.
 * @property array|null $raw_request_email_outro_i18n Email closing paragraph, keyed by language code.
 */
class WebSiteSetting extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'web_site_settings';

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'is_web_active',
        'web_maintenance_message',
        'raw_request_email_title_i18n',
        'raw_request_email_intro_i18n',
        'raw_request_email_outro_i18n',
        'raw_request_email_labels_i18n',
        'raw_request_email_subject_i18n',
    ];

    /**
     * @var array<string, string> The attributes that should be cast.
     */
    protected $casts = [
        'is_web_active'                  => 'boolean',
        'raw_request_email_title_i18n'   => 'array',
        'raw_request_email_intro_i18n'   => 'array',
        'raw_request_email_outro_i18n'   => 'array',
        'raw_request_email_labels_i18n'  => 'array',
        'raw_request_email_subject_i18n' => 'array',
    ];
}