<?php
/**
 * @file AppAvailability.php
 * @path app/Support/Apps/AppAvailability.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public availability of an application (its maintenance switch): online or in
 *   maintenance, with the text the visitors see during the maintenance.
 * @usage `AppManifest::availability()` of an application with public pages; read by the status
 *   overview of the core (CoreAppStatusController).
 * @dependencies none
 */

namespace App\Support\Apps;

final class AppAvailability
{
    /**
     * @param bool $active The public part is online (false = maintenance page, API 503).
     * @param string|null $message Maintenance text for the visitors (null = the default text).
     */
    public function __construct(
        public readonly bool $active,
        public readonly ?string $message = null,
    ) {
    }
}
