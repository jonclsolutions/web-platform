<?php
/**
 * @file CoreLogController.php
 * @path app/Http/Controllers/Api/Core/CoreLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read access to the system-wide audit log (core_logs) - authentication
 * events, user/role/permission management, legal document changes, core site settings. The
 * endpoints are shared by AuditLogController; this class only names the model.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / show.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Api\AuditLogController;
use App\Models\Core\CoreLog;

class CoreLogController extends AuditLogController
{
    /** @description Model of core_logs. */
    protected function model(): string
    {
        return CoreLog::class;
    }
}
