<?php
/**
 * @file WebLogController.php
 * @path app/Http/Controllers/Api/Web/WebLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read/write access to the web-domain audit log (web_logs) - business content
 * activity across job applications, sales leads/orders, raw request
 * commissions and external links. The endpoints are shared by AuditLogController; this class only
 * names the model and the resource.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / store / show.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Resources\Web\WebLogResource;
use App\Models\Web\WebLog;

class WebLogController extends AuditLogController
{
    /** @description Model of web_logs. */
    protected function model(): string
    {
        return WebLog::class;
    }

    /** @description Resource of one web_logs row. */
    protected function resource(): string
    {
        return WebLogResource::class;
    }
}
