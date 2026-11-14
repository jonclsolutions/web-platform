<?php
/**
 * @file WebLogController.php
 * @path app/Apps/Web/Http/Controllers/WebLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read access to the web-domain audit log (web_logs) - inquiries, sales
 * leads and orders, job applications, texts and content of the website. The endpoints are
 * shared by AuditLogController; this class only names the model.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / show.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Api\AuditLogController;
use App\Apps\Web\Models\WebLog;

class WebLogController extends AuditLogController
{
    /** @description Model of web_logs. */
    protected function model(): string
    {
        return WebLog::class;
    }
}
