<?php
/**
 * @file OutputController.php
 * @path app/Apps/JsCreator/Http/Controllers/OutputController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description OWN generated outputs:
 *   - generate (`<section>/outputs`, the section comes from the route): the browser sends the PNG
 *     drawn by the renderer; the API checks that the template and the folder are own, that the
 *     PNG has exactly the size of the template, converts it to the format of the template
 *     (OutputImage), makes a thumbnail and stores it within the quota;
 *   - `outputs`: list (folder, search in every folder, section, sorting, trash), rename / move,
 *     delete to the trash, restore (to the top level when the folder is gone), delete for good,
 *     empty the trash, bulk actions (move, delete, restore, delete for good) and the signed URL of
 *     a ZIP of chosen outputs.
 *   Outputs of every section are in one list, but each output needs the permission of ITS
 *   section for an action (JsCreatorSections::allowed()); every query is limited to the signed-in
 *   account (another account's output = 404, also for the sysadmin).
 * @note The inputs of generating (texts, photos) are never sent - photos chosen from the
 *   computer stay in the browser; only the finished picture and the text of the post are stored.
 *   The audit log names only ids, never names, texts or file names.
 * @dependencies OutputImage, WorkspaceFiles, WorkspaceQuota, JsCreatorSections, CreatorOutput,
 *   CreatorOutputFile, CreatorTemplate, CreatorFolder, OutputResource, AppliesSafeSorting,
 *   LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\OutputSelectionRequest;
use App\Apps\JsCreator\Http\Requests\StoreOutputRequest;
use App\Apps\JsCreator\Http\Requests\UpdateOutputRequest;
use App\Apps\JsCreator\Http\Resources\OutputResource;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\CreatorOutputFile;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Apps\JsCreator\Support\JsCreatorSections;
use App\Apps\JsCreator\Support\OutputImage;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Http\Controllers\Controller;
use App\Traits\AppliesSafeSorting;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class OutputController extends Controller
{
    use AppliesSafeSorting, LogsActivity;

    /** @description Outputs per page of the list. */
    private const PER_PAGE = 48;

    /** @description Largest ZIP of outputs (bytes of the stored files). */
    public const ZIP_MAX_BYTES = 500 * 1024 * 1024;

    /**
     * @description Stores a generated output: the PNG of the browser converted to the format of
     *   the template, its thumbnail, name, text of the post and the template it was made from.
     * @param StoreOutputRequest $request `file`, `template_id`, `folder_id`, `name`, `caption`.
     * @return JsonResponse 201 the output; 422 unknown template / folder, not a PNG, another size
     *   than the template, full quota.
     */
    public function store(StoreOutputRequest $request): JsonResponse
    {
        $userId = $request->user()->id;
        $section = (string) $request->route('section');
        $template = CreatorTemplate::query()->ownedBy($userId)->where('section', $section)->find((int) $request->input('template_id'));
        if ($template === null) {
            throw ValidationException::withMessages(['template_id' => 'The template does not exist (it may have been deleted meanwhile).']);
        }
        $folderId = $this->targetFolder($userId, $request->input('folder_id'));

        try {
            $image = OutputImage::convert(
                (string) file_get_contents($request->file('file')->getRealPath()),
                $template->width, $template->height, $template->output_format, $template->output_quality
            );
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage() === 'wrong_size'
                ? "The picture does not have the size of the template ({$template->width} × {$template->height} px) - the template was probably changed meanwhile, reload the page."
                : 'The file is not a readable PNG image.']);
        }
        $bytes = strlen($image['file']) + strlen($image['thumb']);
        WorkspaceQuota::ensureRoom($userId, $bytes);

        $path = WorkspaceFiles::newPath($userId, 'outputs', $image['extension']);
        $thumb = WorkspaceFiles::newPath($userId, 'outputs', 'webp');
        $name = $request->filled('name') ? (string) $request->input('name') : $this->defaultName($template->name);
        try {
            WorkspaceFiles::put($path, $image['file']);
            WorkspaceFiles::put($thumb, $image['thumb']);
            $output = DB::transaction(function () use ($request, $userId, $folderId, $section, $name, $template, $image, $bytes, $path, $thumb) {
                $output = CreatorOutput::create([
                    'user_id'       => $userId,
                    'folder_id'     => $folderId,
                    'section'       => $section,
                    'name'          => $name,
                    'template_id'   => $template->id,
                    'template_name' => $template->name,
                    'caption'       => $request->input('caption'),
                    'width'         => $template->width,
                    'height'        => $template->height,
                    'format'        => $template->output_format,
                    'page_count'    => 1,
                    'size_bytes'    => $bytes,
                ]);
                CreatorOutputFile::create([
                    'output_id' => $output->id, 'page' => 1, 'path' => $path, 'thumb_path' => $thumb, 'mime' => $image['mime'], 'size_bytes' => $bytes,
                ]);

                return $output;
            });
        } catch (Throwable $e) {
            WorkspaceFiles::delete([$path, $thumb]);
            throw $e;
        }
        $this->logAction($request, JsCreatorLog::class, 'create', 'Output', "Output #{$output->id} generated from template #{$template->id}", $output->id, 'Output', ['file']);

        return $this->respond(new OutputResource($output->load('files')), 201);
    }

    /**
     * @description Page of the own outputs: of one folder (`folder_id`, none = the top level), or
     *   with `search` in the names of every folder; `section` = only one section; `only_trashed=1`
     *   = the items of the trash; `sort_by` created_at | name | size_bytes, `sort_direction`, `page`.
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->outputs($request, 'view')->with('files');
        $search = trim((string) $request->query('search', ''));
        if (filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->onlyTrashed()->whereNull('trash_root_id');
        } elseif ($search === '') {
            $folderId = (int) $request->query('folder_id', 0);
            $folderId > 0 ? $query->where('folder_id', $folderId) : $query->whereNull('folder_id');
        }
        if ($search !== '') {
            $query->where('name', 'like', '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%');
        }
        $section = (string) $request->query('section', '');
        if (in_array($section, JsCreatorSections::SECTIONS, true)) {
            $query->where('section', $section);
        }
        $this->applySorting($query, $request, 'created_at');

        return $this->respondPaginated($query->orderByDesc('id')->paginate(self::PER_PAGE), OutputResource::class);
    }

    /**
     * @description Renames and / or moves an own output (`folder_id` null = to the top level).
     * @param UpdateOutputRequest $request `name`?, `folder_id`?
     * @param string $id Output.
     * @return JsonResponse 200; 404; 422 unknown folder.
     */
    public function update(UpdateOutputRequest $request, string $id): JsonResponse
    {
        $output = $this->outputs($request, 'update')->with('files')->findOrFail((int) $id);
        $moved = false;
        if ($request->has('folder_id')) {
            $folderId = $this->targetFolder($output->user_id, $request->input('folder_id'));
            $moved = $folderId !== $output->folder_id;
            $output->folder_id = $folderId;
        }
        if ($request->has('name')) {
            $output->name = (string) $request->input('name');
        }
        $output->save();
        $this->logAction($request, JsCreatorLog::class, 'update', 'Output', "Output #{$output->id} " . ($moved ? 'moved' : 'renamed'), $output->id, 'Output');

        return $this->respond(new OutputResource($output));
    }

    /**
     * @description Moves an own output to the trash, or (`force=1`) deletes an output of the trash
     *   for good with its files.
     * @param Request $request `force`.
     * @param string $id Output.
     * @return JsonResponse 204; 404.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->outputs($request, 'delete')->onlyTrashed()->whereNull('trash_root_id')->findOrFail((int) $id)->deleteWithFiles();
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Output', "Output #{$id} deleted for good", (int) $id, 'Output');
        } else {
            $this->outputs($request, 'delete')->findOrFail((int) $id)->delete();
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Output', "Output #{$id} moved to the trash", (int) $id, 'Output');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores an output of the trash - into its folder, or to the top level when the
     *   folder is in the trash or gone.
     * @param Request $request
     * @param string $id Output (item of the trash).
     * @return JsonResponse 200; 404.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $output = $this->outputs($request, 'delete')->onlyTrashed()->whereNull('trash_root_id')->with('files')->findOrFail((int) $id);
        $this->restoreOutput($output);
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Output', "Output #{$output->id} restored", $output->id, 'Output');

        return $this->respond(new OutputResource($output));
    }

    /**
     * @description Deletes every output of the own trash for good (outputs deleted with a folder
     *   stay with the folder).
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $outputs = $this->outputs($request, 'delete')->onlyTrashed()->whereNull('trash_root_id')->get();
        $outputs->each(fn (CreatorOutput $output) => $output->deleteWithFiles());
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Output', "Output trash emptied. Count: {$outputs->count()}");

        return response()->json(null, 204);
    }

    /**
     * @description One action on several own outputs: `move` (to `folder_id`), `delete` (to the
     *   trash), `restore` / `destroy` (items of the trash). Outputs that are not own or not
     *   reachable for the action are skipped.
     * @param OutputSelectionRequest $request `action`, `ids`, `folder_id`.
     * @return JsonResponse { count } of the changed outputs; 403 no permission for the action; 422
     *   unknown folder.
     */
    public function bulk(OutputSelectionRequest $request): JsonResponse
    {
        $action = (string) $request->input('action');
        $permission = $action === 'move' ? 'update' : 'delete';
        if (JsCreatorSections::allowed($request->user(), $permission) === []) {
            return response()->json(['message' => 'Insufficient permissions.'], 403);
        }
        $ids = $request->ids();
        $query = $this->outputs($request, $permission)->whereIn('id', $ids);

        $count = match ($action) {
            'move'    => (clone $query)->update(['folder_id' => $this->targetFolder($request->user()->id, $request->input('folder_id')), 'updated_at' => now()]),
            'delete'  => (clone $query)->update(['deleted_at' => now(), 'trash_root_id' => null, 'updated_at' => now()]),
            'restore' => $query->onlyTrashed()->whereNull('trash_root_id')->get()->each(fn (CreatorOutput $o) => $this->restoreOutput($o))->count(),
            'destroy' => $query->onlyTrashed()->whereNull('trash_root_id')->get()->each(fn (CreatorOutput $o) => $o->deleteWithFiles())->count(),
        };
        $events = ['move' => 'update', 'delete' => 'soft_delete', 'restore' => 'restore', 'destroy' => 'hard_delete'];
        $texts = ['move' => 'moved', 'delete' => 'moved to the trash', 'restore' => 'restored', 'destroy' => 'deleted for good'];
        $this->logAction($request, JsCreatorLog::class, $events[$action], 'Output', "Outputs {$texts[$action]}. Count: {$count}");

        return $this->respond(['count' => $count]);
    }

    /**
     * @description Signed URL of a ZIP with the chosen own outputs (outside the trash), valid for
     *   WorkspaceFiles::ZIP_MINUTES; the ZIP is made when the URL is opened (FileController::zip()).
     * @param OutputSelectionRequest $request `ids` (at most 200).
     * @return JsonResponse { url, count, bytes }; 422 nothing to download / over ZIP_MAX_BYTES.
     */
    public function zip(OutputSelectionRequest $request): JsonResponse
    {
        $outputs = $this->outputs($request, 'view')->whereIn('id', $request->ids())->get(['id', 'size_bytes']);
        if ($outputs->isEmpty()) {
            throw ValidationException::withMessages(['ids' => 'None of the outputs can be downloaded.']);
        }
        $bytes = (int) $outputs->sum('size_bytes');
        if ($bytes > self::ZIP_MAX_BYTES) {
            throw ValidationException::withMessages(['ids' => 'The outputs are too large for one ZIP (at most ' . (self::ZIP_MAX_BYTES / 1024 / 1024) . ' MB) - choose fewer.']);
        }

        return $this->respond([
            'url'   => WorkspaceFiles::zipUrl($request->user()->id, $outputs->pluck('id')->sort()->values()->all()),
            'count' => $outputs->count(),
            'bytes' => $bytes,
        ]);
    }

    /**
     * @description Query of the own outputs in the sections where the account may do the action.
     * @param Request $request Request of the signed-in account.
     * @param string $action view | update | delete.
     * @return Builder
     */
    private function outputs(Request $request, string $action): Builder
    {
        return CreatorOutput::query()->ownedBy($request->user())->whereIn('section', JsCreatorSections::allowed($request->user(), $action));
    }

    /**
     * @description Target folder of a new / moved output: an own folder outside the trash.
     * @param int $userId Owner.
     * @param mixed $folderId Folder id of the request (null / empty = the top level).
     * @return int|null
     * @throws ValidationException When the folder is not an own folder outside the trash.
     */
    private function targetFolder(int $userId, mixed $folderId): ?int
    {
        if ($folderId === null || $folderId === '') {
            return null;
        }
        $folder = CreatorFolder::query()->ownedBy($userId)->find((int) $folderId);
        if ($folder === null) {
            throw ValidationException::withMessages(['folder_id' => 'The folder does not exist (it may have been deleted meanwhile).']);
        }

        return $folder->id;
    }

    /**
     * @description Restores an output of the trash; its folder must exist outside the trash,
     *   otherwise the output goes to the top level.
     * @param CreatorOutput $output Item of the trash.
     * @return void
     */
    private function restoreOutput(CreatorOutput $output): void
    {
        if ($output->folder_id !== null && !CreatorFolder::query()->ownedBy($output->user_id)->whereKey($output->folder_id)->exists()) {
            $output->folder_id = null;
        }
        $output->trash_root_id = null;
        $output->restore();
    }

    /**
     * @description Name of an output without a name: the template and the time of generating.
     * @param string $templateName Name of the template.
     * @return string
     */
    private function defaultName(string $templateName): string
    {
        return mb_substr($templateName . ' ' . Carbon::now()->format('Y-m-d H:i'), 0, 150);
    }
}
