<?php
/**
 * @file JsCreatorLog.php
 * @path app/Apps/JsCreator/Models/JsCreatorLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the application "JS Creator" (js_creator_logs) - written by
 *   LogsActivity in its controllers, read by JsCreatorLogController.
 * @dependencies AuditLog (columns, casts, author).
 */

namespace App\Apps\JsCreator\Models;

use App\Models\Core\AuditLog;

final class JsCreatorLog extends AuditLog
{
    /** @var string Table of the log. */
    protected $table = 'js_creator_logs';
}
