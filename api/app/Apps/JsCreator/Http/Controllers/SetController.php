<?php

/**
 * @file SetController.php
 * @path app/Apps/JsCreator/Http/Controllers/SetController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description OWN sets of one section (`<section>/sets`, the section comes from the route): list
 *   (search, sorting, trash), detail, new, save (name, caption pattern, templates in their
 *   order), delete to the trash, restore, delete for good, empty the trash.
 *   The templates of a set must be own templates of the section (a template in the trash may
 *   stay in a set it already belongs to - generating skips it) and fields with the same key must
 *   have the same kind in all of them (block fields included - EffectiveFields); otherwise 422
 *   `field_conflict` names the field and the templates.
 *   Every query is limited to the signed-in account and the section (another account's set or
 *   template = 404 / 422 like a missing one, also for the sysadmin).
 * @note Generating a set is done by the browser: one output per template through
 *   `<section>/outputs` (OutputController::store) - the API keeps no extra state for it.
 * @dependencies CreatorSet, CreatorTemplate, CreatorBlock, CreatorUsage, EffectiveFields,
 *   SaveSetRequest, SetResource, AppliesSafeSorting, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\BulkItemsRequest;
use App\Apps\JsCreator\Http\Requests\SaveSetRequest;
use App\Apps\JsCreator\Http\Resources\SetResource;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUsage;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Support\EffectiveFields;
use App\Http\Controllers\Controller;
use App\Traits\AppliesSafeSorting;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SetController extends Controller
{
    use AppliesSafeSorting, LogsActivity;

    /** @description Sets per page of the list. */
    private const PER_PAGE = 48;

    /**
     * @description Page of the own sets of the section (`only_trashed`, `search` in the name,
     *   `sort_by` name | updated_at | created_at, `sort_direction`, `page`) with their templates.
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->sets($request)->with('templates');
        if (filter_var($request->query('only_trashed', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->onlyTrashed();
        }
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where('name', 'like', '%' . addcslashes(mb_substr($search, 0, 100), '%_\\') . '%');
        }
        $this->applySorting($query, $request, 'updated_at');

        return $this->respondPaginated($query->paginate(self::PER_PAGE), SetResource::class);
    }

    /**
     * @description An own set outside the trash with its templates.
     * @param Request $request
     * @param string $id Set.
     * @return JsonResponse 200; 404.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        return $this->respond(new SetResource($this->sets($request)->with('templates')->findOrFail((int) $id)));
    }

    /**
     * @description New set.
     * @param SaveSetRequest $request `name`, `caption_template`, `template_ids`.
     * @return JsonResponse 201; 422 (templates, `field_conflict`).
     */
    public function store(SaveSetRequest $request): JsonResponse
    {
        $ids = $this->checkedTemplates($request, []);
        $set = DB::transaction(function () use ($request, $ids) {
            $set = CreatorSet::create([
                'user_id'          => $request->user()->id,
                'section'          => $this->section($request),
                'name'             => $request->input('name'),
                'caption_template' => $request->input('caption_template'),
            ]);
            $this->syncTemplates($set, $ids);

            return $set;
        });
        $this->logAction($request, JsCreatorLog::class, 'create', 'Set', "Set #{$set->id} created", $set->id, 'Set');

        return $this->respond(new SetResource($set->load('templates')), 201);
    }

    /**
     * @description Saves a set (name, caption pattern, templates in their order).
     * @param SaveSetRequest $request `name`, `caption_template`, `template_ids`.
     * @param string $id Set.
     * @return JsonResponse 200; 404; 422 (templates, `field_conflict`).
     */
    public function update(SaveSetRequest $request, string $id): JsonResponse
    {
        $set = $this->sets($request)->findOrFail((int) $id);
        $current = $set->templates()->pluck('js_creator_templates.id')->map(fn ($v) => (int) $v)->all();
        $ids = $this->checkedTemplates($request, $current);
        DB::transaction(function () use ($request, $set, $ids) {
            // touch() saves the new name / pattern too and marks the set changed also when only its templates did.
            $set->fill(['name' => $request->input('name'), 'caption_template' => $request->input('caption_template')])->touch();
            $this->syncTemplates($set, $ids);
        });
        $this->logAction($request, JsCreatorLog::class, 'update', 'Set', "Set #{$set->id} saved", $set->id, 'Set');

        return $this->respond(new SetResource($set->refresh()->load('templates')));
    }

    /**
     * @description Moves an own set to the trash, or (`force=1`) deletes a set of the trash for good
     *   (its templates stay).
     * @param Request $request `force`.
     * @param string $id Set.
     * @return JsonResponse 204; 404.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (filter_var($request->query('force', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->sets($request)->onlyTrashed()->findOrFail((int) $id)->forceDelete();
            $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Set', "Set #{$id} deleted for good", (int) $id, 'Set');
        } else {
            $this->sets($request)->findOrFail((int) $id)->delete();
            $this->logAction($request, JsCreatorLog::class, 'soft_delete', 'Set', "Set #{$id} moved to the trash", (int) $id, 'Set');
        }

        return response()->json(null, 204);
    }

    /**
     * @description Restores a set of the trash.
     * @param Request $request
     * @param string $id Set.
     * @return JsonResponse 200; 404.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $set = $this->sets($request)->onlyTrashed()->findOrFail((int) $id);
        $set->restore();
        $this->logAction($request, JsCreatorLog::class, 'restore', 'Set', "Set #{$set->id} restored", $set->id, 'Set');

        return $this->respond(new SetResource($set->load('templates')));
    }

    /**
     * @description One action on several own sets (multiselect): `delete` (to the trash),
     *   `restore` / `destroy` (items of the trash for good - their templates stay).
     * @param BulkItemsRequest $request `action`, `ids`.
     * @return JsonResponse { count, skipped: [] }.
     */
    public function bulk(BulkItemsRequest $request): JsonResponse
    {
        $action = (string) $request->input('action');
        $query = $this->sets($request)->whereIn('id', $request->ids());
        $items = ($action === 'delete' ? $query : $query->onlyTrashed())->get();
        $run = fn () => $items->each(fn (CreatorSet $set) => match ($action) {
            'delete'  => $set->delete(),
            'restore' => $set->restore(),
            'destroy' => $set->forceDelete(),
        });
        // Files of a deleted item are removed at once, so a destroy does not run in a transaction.
        $action === 'destroy' ? $run() : DB::transaction($run);
        $this->logAction($request, JsCreatorLog::class, TemplateController::BULK_EVENTS[$action], 'Set', "Sets in bulk: {$action}. Count: {$items->count()}");

        return $this->respond(['count' => $items->count(), 'skipped' => []]);
    }

    /**
     * @description Deletes every set of the own trash of the section for good.
     * @param Request $request
     * @return JsonResponse 204.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        $sets = $this->sets($request)->onlyTrashed()->get();
        $sets->each(fn (CreatorSet $set) => $set->forceDelete());
        $this->logAction($request, JsCreatorLog::class, 'force_delete_all', 'Set', "Set trash emptied. Count: {$sets->count()}");

        return response()->json(null, 204);
    }

    /**
     * @description Query of the own sets of the section of the route.
     * @param Request $request Request of the signed-in account.
     * @return Builder
     */
    private function sets(Request $request): Builder
    {
        return CreatorSet::query()->ownedBy($request->user())->where('section', $this->section($request));
    }

    /**
     * @description Section of the route (route default `section`, one route group per section -
     *   never taken from the URL).
     * @param Request $request
     * @return string
     */
    private function section(Request $request): string
    {
        return (string) $request->route('section');
    }

    /**
     * @description Checks the templates of a set: own templates of the section (a template in the
     *   trash only when it already is in the set) whose fields with the same key have the same
     *   kind (block fields included).
     * @param SaveSetRequest $request Request with `template_ids`.
     * @param int[] $current Templates the set has now.
     * @return int[] Template ids in their order.
     * @throws ValidationException 422 `template_ids.<n>`.
     * @throws HttpResponseException 422 `field_conflict`.
     */
    private function checkedTemplates(SaveSetRequest $request, array $current): array
    {
        $ids = array_map('intval', $request->input('template_ids', []));
        $templates = CreatorTemplate::withTrashed()->ownedBy($request->user())->where('section', $this->section($request))
            ->whereIn('id', $ids)->get()->keyBy('id');
        $errors = [];
        foreach ($ids as $i => $id) {
            $template = $templates->get($id);
            if ($template === null) {
                $errors["template_ids.{$i}"] = 'The template is not among your templates.';
            } elseif ($template->trashed() && !in_array($id, $current, true)) {
                $errors["template_ids.{$i}"] = 'The template is in the trash.';
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $blockIds = CreatorUsage::query()->where('owner_type', CreatorTemplate::USAGE_OWNER)->whereIn('owner_id', $ids)
            ->where('target_type', CreatorUsage::BLOCK)->pluck('target_id')->all();
        $blocks = CreatorBlock::withTrashed()->ownedBy($request->user())->whereIn('id', $blockIds)->get()
            ->mapWithKeys(fn (CreatorBlock $block) => [$block->id => $block->document])->all();

        $seen = [];
        foreach ($ids as $i => $id) {
            $template = $templates->get($id);
            foreach (EffectiveFields::types($template->document, $blocks) as $key => $type) {
                $first = $seen[$key] ??= ['type' => $type, 'template_id' => $id];
                if ($first['type'] !== $type) {
                    throw new HttpResponseException(response()->json([
                        'message'    => "The field \"{$key}\" is of another kind in the templates of the set.",
                        'error_code' => 'field_conflict',
                        'errors'     => ["template_ids.{$i}" => ["The field \"{$key}\" is of another kind than in another template of the set."]],
                        'conflict'   => [
                            'key'         => $key,
                            'template_id' => $id,
                            'type'        => $type,
                            'other_id'    => $first['template_id'],
                            'other_type'  => $first['type'],
                        ],
                    ], 422));
                }
            }
        }

        return $ids;
    }

    /**
     * @description Replaces the templates of a set (in the given order).
     * @param CreatorSet $set Set.
     * @param int[] $ids Template ids.
     * @return void
     */
    private function syncTemplates(CreatorSet $set, array $ids): void
    {
        $rows = [];
        foreach (array_values($ids) as $position => $id) {
            $rows[$id] = ['position' => $position];
        }
        $set->templates()->sync($rows);
    }
}
