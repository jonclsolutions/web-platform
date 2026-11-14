<?php
/**
 * @file ProjectPortalLog.php
 * @path app/Apps/ProjectPortal/Models/ProjectPortalLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the project portal (project_portal_logs): changes of projects, their
 *   checkpoints, threads, updates, approvals, templates and client accounts made in the admin, and
 *   the activity of the clients in the portal (sign-in, threads, decisions).
 * @dependencies AuditLog (columns, casts, author).
 */

namespace App\Apps\ProjectPortal\Models;

use App\Models\Core\AuditLog;

final class ProjectPortalLog extends AuditLog
{
    /** @var string Table of the log. */
    protected $table = 'project_portal_logs';
}
