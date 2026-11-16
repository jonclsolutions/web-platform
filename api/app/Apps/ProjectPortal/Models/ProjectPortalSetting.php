<?php
/**
 * @file ProjectPortalSetting.php
 * @path app/Apps/ProjectPortal/Models/ProjectPortalSetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings of the project portal (table project_portal_settings, one row): the
 *   maintenance switch of the public portal and order form, and the editable confirmation e-mail
 *   of an order, per language (VT-15).
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Single settings row of the portal (ProjectPortalSetting::current()).
 * @property bool $is_portal_active The public portal and order form are online (false = maintenance).
 * @property string|null $portal_maintenance_message Text of the maintenance page (null = default text).
 * @property array|null $sales_order_email_subject_i18n E-mail subject, keyed by language code.
 * @property array|null $sales_order_email_title_i18n E-mail heading, keyed by language code.
 * @property array|null $sales_order_email_intro_i18n Introduction paragraph, keyed by language code.
 * @property array|null $sales_order_email_outro_i18n Closing paragraph, keyed by language code.
 * @property array|null $sales_order_email_labels_i18n Labels of the summary, keyed by language code.
 */
class ProjectPortalSetting extends Model
{
    /** @var string The table of the model. */
    protected $table = 'project_portal_settings';

    /** @description Fields of the order confirmation e-mail template (SalesOrderEmailTemplate). */
    public const SALES_ORDER_TEMPLATE_FIELDS = [
        'sales_order_email_subject_i18n', 'sales_order_email_title_i18n', 'sales_order_email_intro_i18n',
        'sales_order_email_outro_i18n', 'sales_order_email_labels_i18n',
    ];

    /** @description Cache key of the switch (CheckProjectPortalActive, public status). */
    public const ACTIVE_CACHE_KEY = 'site_setting_active_project_portal';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = [...self::SALES_ORDER_TEMPLATE_FIELDS, 'is_portal_active', 'portal_maintenance_message'];

    /** @var array<string, mixed> Defaults of a new row (the portal is online). */
    protected $attributes = ['is_portal_active' => true];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = [
        'is_portal_active'               => 'boolean',
        'sales_order_email_subject_i18n' => 'array',
        'sales_order_email_title_i18n'   => 'array',
        'sales_order_email_intro_i18n'   => 'array',
        'sales_order_email_outro_i18n'   => 'array',
        'sales_order_email_labels_i18n'  => 'array',
    ];

    /**
     * @description The settings row (created empty on first use).
     * @return self
     */
    public static function current(): self
    {
        return self::query()->firstOrCreate([]);
    }
}
