<?php
/**
 * @file WebSiteSetting.php
 * @path app/Apps/Web/Models/WebSiteSetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Global settings of the public web: maintenance mode (flag + message for
 * visitors) and the editable i18n template of the WebRawRequestCommission confirmation e-mail
 * (heading / introduction / closing).
 */

namespace App\Apps\Web\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores the public web's global availability state (maintenance mode),
 * the message shown to visitors while it is disabled, and the editable per-language
 * confirmation e-mail template of the inquiries (raw_request_email_*, VT-15).
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