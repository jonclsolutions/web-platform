<?php
/**
 * @file CoreNotificationSource.php
 * @path app/Services/Notifications/CoreNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the core: new security events (a new suspicious activity; more
 * occurrences of one already recorded event are not new) and the texts of the company profile
 * missing in a language (core_company_texts_missing - the tagline: orange for
 * the languages visitors see, `preparing` grey for the switched-off ones; for the admins who may
 * edit the company details). Used by CoreNotificationController next to the sources of the
 * applications.
 * @dependencies CoreSecurityEvent, CompanyTextsMissing, TranslationController, NotificationContext
 */

namespace App\Services\Notifications;

use App\Http\Controllers\Api\TranslationController;
use App\Models\Core\CoreSecurityEvent;
use App\Support\I18n\CompanyTextsMissing;

final class CoreNotificationSource implements NotificationSource
{
    /** @description See NotificationSource::kinds(). */
    public function kinds(NotificationContext $context): array
    {
        $kinds = [];
        if ($context->can('core-security-view')) {
            $kinds[] = $context->created('core_security_events', '/admin/core/security-events', CoreSecurityEvent::query(), 'first_seen_at');
        }
        if ($context->can('core-legal-config-update')) {
            $missing = CompanyTextsMissing::byLanguage();
            $kinds[] = $context->attention('core_company_texts_missing', '/admin/core/settings', array_sum($missing), $missing,
                CompanyTextsMissing::byLanguage(TranslationController::inactiveLanguageCodesOfAll()));
        }

        return $kinds;
    }
}
