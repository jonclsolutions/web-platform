<?php
/**
 * @file __APP__Log.php
 * @path app/Apps/__APP__/Models/__APP__Log.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Audit log of the application "__NAME__" (__app_snake___logs) - written by
 *   LogsActivity in its controllers, read by __APP__LogController.
 * @dependencies AuditLog (columns, casts, author).
 */

namespace App\Apps\__APP__\Models;

use App\Models\Core\AuditLog;

final class __APP__Log extends AuditLog
{
    /** @var string Table of the log. */
    protected $table = '__app_snake___logs';
}
