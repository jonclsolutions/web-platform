<?php
/**
 * @file UsageController.php
 * @path app/Apps/JsCreator/Http/Controllers/UsageController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Usage of the OWN workspace for the usage bar of the admin: used and allowed bytes
 *   (trash included), bytes in the trash and the numbers of folders, images, fonts and templates.
 * @dependencies WorkspaceQuota, CreatorFolder, CreatorAsset, CreatorFont, CreatorTemplate.
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UsageController extends Controller
{
    /**
     * @description Usage of the workspace of the signed-in account.
     * @param Request $request
     * @return JsonResponse { used_bytes, quota_bytes, trash_bytes, counts: { folders, images, fonts, templates } }
     */
    public function show(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return $this->respond([
            'used_bytes'  => WorkspaceQuota::usedBytes($userId),
            'quota_bytes' => WorkspaceQuota::quotaBytes($userId),
            'trash_bytes' => (int) CreatorAsset::onlyTrashed()->ownedBy($userId)->sum('size_bytes')
                + (int) CreatorFont::onlyTrashed()->ownedBy($userId)->sum('size_bytes')
                + (int) CreatorTemplate::onlyTrashed()->ownedBy($userId)->sum('thumb_bytes'),
            'counts'      => [
                'folders'   => CreatorFolder::query()->ownedBy($userId)->count(),
                'images'    => CreatorAsset::query()->ownedBy($userId)->count(),
                'fonts'     => CreatorFont::query()->ownedBy($userId)->count(),
                'templates' => CreatorTemplate::query()->ownedBy($userId)->count(),
            ],
        ]);
    }
}
