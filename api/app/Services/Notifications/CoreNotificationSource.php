<?php
/**
 * @file CoreNotificationSource.php
 * @path app/Services/Notifications/CoreNotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the core: new security events (a new suspicious activity; more
 * occurrences of one already recorded event are not new). Used by CoreNotificationController
 * next to the sources of the applications.
 * @dependencies CoreSecurityEvent, NotificationContext
 */

namespace App\Services\Notifications;

use App\Models\Core\CoreSecurityEvent;

final class CoreNotificationSource implements NotificationSource
{
    /** @description See NotificationSource::kinds(). */
    public function kinds(NotificationContext $context): array
    {
        return $context->can('core-security-view')
            ? [$context->created('core_security_events', '/admin/core/security-events', CoreSecurityEvent::query(), 'first_seen_at')]
            : [];
    }
}
