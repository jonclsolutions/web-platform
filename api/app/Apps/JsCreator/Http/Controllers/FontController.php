<?php
/**
 * @file FontController.php
 * @path app/Apps/JsCreator/Http/Controllers/FontController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description OWN fonts of the library: list (trash), upload of one face (within the quota),
 *   change of the face, delete to the trash, restore, delete for good, empty the trash. A face
 *   (family + weight + style, case-insensitive) exists at most once outside the trash. Every
 *   query is limited to the signed-in account (another account's font = 404, also for the
 *   sysadmin).
 * @note The audit log names only the id of a font, never its family.
 * @dependencies StoreFontRequest (format), WorkspaceFiles, WorkspaceQuota, CreatorFont,
 *   FontResource, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\StoreFontRequest;
use App\Apps\JsCreator\Http\Requests\UpdateFontRequest;
use App\Apps\JsCreator\Http\Resources\FontResource;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class FontController extends Controller
{
    use LogsActivity;

    /**
     * @description Own fonts (`only_trashed=1` = the trash), by family, weight and style.
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = CreatorFont::query()->ownedBy($request->user());
        if (filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->onlyTrashed();
        }

        return $this->respond(FontResource::collection($query->orderBy('family')->orderBy('weight')->orderBy('style')->get()));
    }

    /**
     * @description Uploads one face of a font.
     * @param StoreFontRequest $request `file`, `family`, `weight`, `style`.
     * @return JsonResponse 201; 422 invalid file / face exists / full quota.
     */
    public function store(StoreFontRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $face = $request->only(['family', 'weight', 'style']);
        $this->ensureFreeFace($userId, $face);

        $file = $request->file('file');
        $format = StoreFontRequest::formatOf($file);
        $size = (int) $file->getSize();
        WorkspaceQuota::ensureRoom($userId, $size);

        $path = WorkspaceFiles::newPath($userId, 'fonts', $format);
        WorkspaceFiles::put($path, (string) file_get_contents($file->getRealPath()));
        try {
            $font = CreatorFont::create(['user_id' => $userId, 'format' => $format, 'path' => $path, 'size_bytes' => $size] + $face);
        } catch (Throwable $e) {
            WorkspaceFiles::delete([$path]);
            throw $e;
        }
        $this->logAction($request, JsCreatorLog::class, 'create', 'Font', "Font #{$font->id} uploaded", $font->id, 'Font');

        return $this->respond(new FontResource($font), 201);
    }

    /**
     * @description Changes the face of an own font.
     * @param UpdateFontRequest $request `family`, `weight`, `style`.
     * @param string $id Font.
     * @return JsonResponse 200; 404; 422 face exists.
     */
    public function update(UpdateFontRequest $request, string $id): JsonResponse
    {
        $font = CreatorFont::query()->ownedBy($request->user())->findOrFail((int) $id);
        $face = $request->only(['family', 'weight', 'style']);
        $this->ensureFreeFace($font->user_id, $face, $font->id);
        $font->update($face);
        $this->logAction($request, JsCreatorLog::class, 'update', 'Font', "Font #{$font->id} changed", $font->id, 'Font');

        return $this->respond(new FontResource($font));
    }

    /**
     * @description Moves an own font to the trash, or (`force=1`) deletes a font of the trash for
     *   good with its file.
     * @param Request $request `force`.
     * @param string $id Font.
     * @return JsonResponse 204; 404.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            CreatorFont::onlyTrashed()->ownedBy($request->user())->findOrFail((int) $id)->deleteWithFiles();
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Font', "Font #{$id} deleted for good", (int) $id, 'Font');
        } else {
            CreatorFont::query()->ownedBy($request->user())->findOrFail((int) $id)->delete();
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Font', "Font #{$id} moved to the trash", (int) $id, 'Font');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores a font of the trash (refused while the same face exists outside it).
     * @param Request $request
     * @param string $id Font.
     * @return JsonResponse 200; 404; 422 face exists.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $font = CreatorFont::onlyTrashed()->ownedBy($request->user())->findOrFail((int) $id);
        $this->ensureFreeFace($font->user_id, $font->only(['family', 'weight', 'style']));
        $font->restore();
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Font', "Font #{$font->id} restored", $font->id, 'Font');

        return $this->respond(new FontResource($font));
    }

    /**
     * @description Deletes every font of the own trash for good.
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $fonts = CreatorFont::onlyTrashed()->ownedBy($request->user())->get();
        $fonts->each(fn (CreatorFont $font) => $font->deleteWithFiles());
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Font', "Font trash emptied. Count: {$fonts->count()}");

        return response()->json(null, 204);
    }


    /**
     * @description Refuses a face that another font of the account outside the trash already is.
     * @param int $userId Account.
     * @param array{family: string, weight: int|string, style: string} $face Face.
     * @param int|null $exceptId The changed font.
     * @return void
     * @throws ValidationException
     */
    private function ensureFreeFace(int $userId, array $face, ?int $exceptId = null): void
    {
        $taken = CreatorFont::query()->ownedBy($userId)
            ->whereRaw('LOWER(family) = ?', [mb_strtolower($face['family'])])
            ->where('weight', (int) $face['weight'])->where('style', $face['style'])
            ->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($taken) {
            throw ValidationException::withMessages(['family' => 'A font with this family, weight and style already exists.']);
        }
    }
}
