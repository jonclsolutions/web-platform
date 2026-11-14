<?php
/**
 * @file ProjectPortalLogController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/ProjectPortalLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read access to the audit log of the project portal (project_portal_logs). The
 *   endpoints are shared by AuditLogController; this class only names the model.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / show.
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Http\Controllers\Api\AuditLogController;

class ProjectPortalLogController extends AuditLogController
{
    /** @description Model of project_portal_logs. */
    protected function model(): string
    {
        return ProjectPortalLog::class;
    }
}
