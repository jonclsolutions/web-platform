<?php
/**
 * @file NotificationSource.php
 * @path app/Services/Notifications/NotificationSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One source of the admin notifications (CoreNotificationController): the kinds of
 * records of one module that are worth a number in the side menu - new inquiries, new orders,
 * products that fell under their stock limit … - counted for one admin as "unread": what came
 * after their last look at the kind. The core has its own source (CoreNotificationSource); every
 * application registers its sources in its manifest (AppManifest::notificationSources()).
 * @usage Build the kinds with the NotificationContext passed in - it checks the permissions of the
 *   signed-in user, knows their last look at every kind and gives every kind the module of the
 *   source. A kind belongs to one admin page (its link): opening that page marks the kind as seen.
 * @note Besides the unread kinds (red) a source may return attention kinds
 *   (NotificationContext::attention(), orange): a current state that needs work (texts missing in
 *   a language …) - shown until it is done, not cleared by opening the page.
 * @dependencies NotificationContext
 */

namespace App\Services\Notifications;

interface NotificationSource
{
    /**
     * @description Kinds the user may see, each with its count of unread records (also 0 - the
     *   menu needs to know which numbers to clear).
     * @param NotificationContext $context Permission check, last looks and kind builder.
     * @return array<int, array{kind: string, module: string, link: string, count: int, attention?: true}>
     *   Built by NotificationContext::created() / counted() / attention().
     */
    public function kinds(NotificationContext $context): array;
}
