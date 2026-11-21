<?php
/**
 * @file JsCreatorLogController.php
 * @path app/Apps/JsCreator/Http/Controllers/JsCreatorLogController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read access to the audit log of the application "JS Creator" (js_creator_logs).
 *   The endpoints are shared by AuditLogController; this class only names the model.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / show.
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Http\Controllers\Api\AuditLogController;

class JsCreatorLogController extends AuditLogController
{
    /** @description Model of js_creator_logs. */
    protected function model(): string
    {
        return JsCreatorLog::class;
    }
}
