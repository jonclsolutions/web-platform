<?php
/**
 * @file __APP__LogController.php
 * @path app/Apps/__APP__/Http/Controllers/__APP__LogController.php
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Read access to the audit log of the application "__NAME__" (__app_snake___logs).
 *   The endpoints are shared by AuditLogController; this class only names the model.
 * @dependencies
 * - App\Http\Controllers\Api\AuditLogController: index / show.
 */

namespace App\Apps\__APP__\Http\Controllers;

use App\Apps\__APP__\Models\__APP__Log;
use App\Http\Controllers\Api\AuditLogController;

class __APP__LogController extends AuditLogController
{
    /** @description Model of __app_snake___logs. */
    protected function model(): string
    {
        return __APP__Log::class;
    }
}
