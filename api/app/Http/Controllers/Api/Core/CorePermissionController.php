<?php
/**
 * @file CorePermissionController.php
 * @path app/Http/Controllers/Api/Core/CorePermissionController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Read-only listing of all available system permissions, used to render the
 *              permission matrix (rows) on the role management page. Permissions themselves
 *              are seeded/managed directly in the database, not through this API.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CorePermission;
use Illuminate\Http\JsonResponse;

class CorePermissionController extends Controller
{
    /**
     * Returns all permissions, ordered by module then key, so the frontend can group them
     * into sections (Web / Shop / Core) without any extra requests.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $permissions = CorePermission::query()
            ->orderBy('module')
            ->orderBy('permission_key')
            ->get(['id', 'permission_key', 'description', 'module']);

        return response()->json($permissions);
    }
}