<?php
/**
 * @file AppManifest.php
 * @path app/Support/Apps/AppManifest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Description of one application of the platform for the core. The core never
 * names an application or its classes - it asks the registered manifests (config/apps.php via
 * AppRegistry) for what it needs: base data, retention, calendar entries, upload rules and
 * folders, the audit log, morph aliases and what to do when a language is deleted.
 * @usage One final class per application (e.g. App\Services\Web\WebApp) extending this class,
 *   listed in config/apps.php. Only id(), tabPermission() and logModel() are required; the rest
 *   defaults to "nothing".
 * @dependencies none
 */

namespace App\Support\Apps;

abstract class AppManifest
{
    /**
     * @description Identifier of the application - also the first API path segment of its admin
     *   routes (`api/<id>/…`) and its translation module (`translations/<id>/…`).
     * @return string e.g. 'web'
     */
    abstract public function id(): string;

    /**
     * @description Permission that shows the application in the admin at all (its tab) - without
     *   it no page and no calendar entry of the application is offered.
     * @return string e.g. 'view-web'
     */
    abstract public function tabPermission(): string;

    /**
     * @description Audit log model of the application (LogsActivity target of its changes,
     *   exports, downloads of its files and translation changes).
     * @return class-string<\Illuminate\Database\Eloquent\Model>
     */
    abstract public function logModel(): string;

    /**
     * @description Base data seeders (permissions, page titles, settings rows, default media),
     *   run by BaseDataSeeder after the core data.
     * @return array<int, class-string<\Database\Seeders\ModuleBaseDataSeeder>>
     */
    public function baseDataSeeders(): array
    {
        return [];
    }

    /**
     * @description Retention sources of the application (GDPR storage limitation).
     * @return array<int, class-string<\App\Services\Retention\RetentionSource>>
     */
    public function retentionSources(): array
    {
        return [];
    }

    /**
     * @description Sources of the admin calendar (dated events and open work).
     * @return array<int, class-string<\App\Services\Agenda\AgendaSource>>
     */
    public function agendaSources(): array
    {
        return [];
    }

    /**
     * @description Upload profiles of the application (AttachmentPolicy): name => extensions,
     *   max_files, max_file_kb, max_total_bytes. Names must be unique over all applications.
     * @return array<string, array{extensions: list<string>, max_files: int, max_file_kb: int, max_total_bytes: int|null}>
     */
    public function uploadProfiles(): array
    {
        return [];
    }

    /**
     * @description Folders of the private disk the application uploads attachments to - checked
     *   daily for files without a record (storage:prune-orphans).
     * @return array<int, string>
     */
    public function uploadFolders(): array
    {
        return [];
    }

    /**
     * @description Morph aliases of the application's models that own attachments (stored in
     *   `attachable_type` instead of the class name, so the class may move).
     * @return array<string, class-string<\Illuminate\Database\Eloquent\Model>>
     */
    public function morphMap(): array
    {
        return [];
    }

    /**
     * @description Permission needed to change the application's translations and languages
     *   (null = only the sysadmin).
     * @return string|null
     */
    public function translationPermission(): ?string
    {
        return null;
    }

    /**
     * @description Removes the texts of a language the admin deleted from the application's
     *   content (e.g. translated FAQ items).
     * @param string $code Language code.
     * @return void
     */
    public function languageDeleted(string $code): void
    {
    }
}
