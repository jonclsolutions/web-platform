<?php
/**
 * @file CoreExternalLinkController.php
 * @path app/Http/Controllers/Api/Core/CoreExternalLinkController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal list of external links shown in the admin (analytics dashboard, webmail,
 * Search Console, ...) - plain links, no live statistics. Every query is scoped to the logged-in
 * user. Changes are written to the core audit log (CoreLog, module CoreExternalLink).
 * @note No import - a personal bookmark list of a few entries does not need a file import.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreExternalLink\StoreCoreExternalLinkRequest;
use App\Http\Requests\Core\CoreExternalLink\UpdateCoreExternalLinkRequest;
use App\Http\Resources\Core\CoreExternalLinkResource;
use App\Models\Core\CoreExternalLink;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Traits\AppliesSafeSorting;

class CoreExternalLinkController extends Controller
{
    use LogsActivity, AppliesSafeSorting;

    /**
     * @description Returns the external links OF THE LOGGED-IN USER (active, or trashed with
     *              ?only_trashed=) with filtering, sorting and optional pagination.
     */
    /**
     * @note `search` is wrapped in its own `where(function ($q) { ... })`: a bare `orWhere()` on
     * `$query` would be OR-ed with the `user_id` scope and return links of other users whose
     * `url` matches. Wrapped, the query is `user_id = ? AND (name LIKE ? OR url LIKE ?)`.
     * `search` and the column filters (`name`, `url`) narrow the result together (AND).
     */
    public function index(Request $request): JsonResponse
    {
        $query = $request->boolean('only_trashed')
            ? CoreExternalLink::onlyTrashed()
            : CoreExternalLink::query();

        $query->where('user_id', $request->user()->id);

        if ($name = $request->input('name')) {
            $query->where('name', 'like', "%{$name}%");
        }
        if ($url = $request->input('url')) {
            $query->where('url', 'like', "%{$url}%");
        }

        // Full-text search over the text columns - wrapped because of the user_id scope (see above).
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('url', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $request, 'name', 'asc');

        if ($request->boolean('no_pagination')) {
            return $this->respond(CoreExternalLinkResource::collection($query->get()));
        }

        $perPage = (int) $request->input('per_page', 15);
        $paginated = $query->paginate($perPage);

        return $this->respondPaginated($paginated, CoreExternalLinkResource::class);
    }

    /**
     * @description Returns one link - only when it belongs to the logged-in user (trashed ones
     *              included, for the trash view). A foreign ID gives 404, not 403.
     */
    public function show(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::withTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return $this->respond(new CoreExternalLinkResource($link));
    }

    /**
     * @description Creates an external link - the owner is always the logged-in user, whatever
     *              the request contains.
     */
    public function store(StoreCoreExternalLinkRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $link = CoreExternalLink::create([
            'user_id' => $request->user()->id,
            'name'    => $validated['name'],
            'url'     => $validated['url'],
        ]);

        $this->logAction($request, CoreLog::class, 'create', 'CoreExternalLink', "Created external link: {$link->name}", $link->id, 'CoreExternalLink');
        return $this->respond(new CoreExternalLinkResource($link), 201);
    }

    /**
     * @description Updates an external link - only when it belongs to the logged-in user.
     */
    public function update(UpdateCoreExternalLinkRequest $request, $id): JsonResponse
    {
        $link = CoreExternalLink::where('user_id', $request->user()->id)->findOrFail($id);

        $link->update($request->validated());

        $this->logAction($request, CoreLog::class, 'update', 'CoreExternalLink', "Updated external link: {$link->name}", $link->id, 'CoreExternalLink');
        return $this->respond(new CoreExternalLinkResource($link));
    }

    /**
     * @description Soft-deletes a link (moves it to the trash) - only when it belongs to the
     *              logged-in user.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::where('user_id', $request->user()->id)->findOrFail($id);
        $name = $link->name;
        $link->delete();

        $this->logAction($request, CoreLog::class, 'soft_delete', 'CoreExternalLink', "Deleted external link: {$name}", (int) $id, 'CoreExternalLink');
        return response()->json(null, 204);
    }

    /**
     * @description Deletes the selected links in ONE request (TableBuilderComponent
     * onBulkDeleteClick() → POST core/external_links/bulk-delete). Scoped to the `user_id` of the
     * logged-in user: IDs of other users are not found and count as `skipped_count` without a
     * reason (same principle as 404 for a foreign ID).
     * @param Request $request Body `{ ids: number[], force_delete?: boolean }`.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'          => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*'        => ['integer'],
            'force_delete' => ['sometimes', 'boolean'],
        ]);

        $ids = array_values(array_unique(array_map('intval', $validated['ids'])));
        $forceDelete = filter_var($validated['force_delete'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $requestedCount = count($ids);
        $deletedCount = 0;
        $userId = $request->user()->id;

        try {
            DB::transaction(function () use ($ids, $forceDelete, $userId, &$deletedCount) {
                // CRITICAL: where('user_id', $userId) - without it foreign links could be deleted just by
                // guessing IDs. Same scope as destroy().
                $items = CoreExternalLink::withTrashed()
                    ->where('user_id', $userId)
                    ->whereIn('id', $ids)
                    ->get();

                foreach ($items as $item) {
                    $forceDelete ? $item->forceDelete() : $item->delete();
                    $deletedCount++;
                }
            });
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'CoreExternalLink', "Error during bulk deletion of external links: " . $e->getMessage());
            return response()->json(['message' => 'Bulk deletion failed.'], 500);
        }

        $skippedCount = $requestedCount - $deletedCount;
        $idsPreview = implode(',', array_slice($ids, 0, 50)) . (count($ids) > 50 ? '...' : '');

        $this->logAction(
            $request,
            CoreLog::class,
            $forceDelete ? 'hard_delete_bulk' : 'soft_delete_bulk',
            'CoreExternalLink',
            'Bulk ' . ($forceDelete ? 'permanent ' : '') . "deletion of {$deletedCount} external links (requested {$requestedCount}, IDs: {$idsPreview}).",
            null,
            'CoreExternalLink'
        );

        return $this->respond([
            'deleted_count' => $deletedCount,
            'skipped_count' => $skippedCount,
            'requested'     => $requestedCount,
        ]);
    }

    /**
     * @description Restores a link from the trash - only when it belongs to the logged-in user.
     */
    public function restore(Request $request, $id): JsonResponse
    {
        $link = CoreExternalLink::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $link->restore();

        $this->logAction($request, CoreLog::class, 'restore', 'CoreExternalLink', "Restored external link: {$link->name}", $link->id, 'CoreExternalLink');
        return $this->respond(new CoreExternalLinkResource($link));
    }

    /**
     * @description Permanently deletes every TRASHED link OF THE LOGGED-IN USER (irreversible) -
     *              never data of other users.
     */
    public function forceDeleteAllTrashed(Request $request): JsonResponse
    {
        $ownTrashed = CoreExternalLink::onlyTrashed()->where('user_id', $request->user()->id);
        $count = $ownTrashed->count();
        $ownTrashed->forceDelete();

        $this->logAction($request, CoreLog::class, 'force_delete_all', 'CoreExternalLink', "Permanently deleted {$count} external links from trash");
        return response()->json(null, 204);
    }
}