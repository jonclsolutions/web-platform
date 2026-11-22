<?php

/**
 * @file PresetController.php
 * @path app/Apps/JsCreator/Http/Controllers/PresetController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description OWN presets of one section (`<section>/presets`, the section comes from the route):
 *   saved fillings of the form of generating of a template or a set - texts, library images,
 *   crops and the text of the post (PresetValues). List of one template / set, new, overwrite,
 *   delete (no trash - a preset is a small convenience, deleted after a confirmation).
 *   The template / set must be an own one of the section outside the trash, the images own
 *   library images outside the trash; the name is unique within the template / set (ignoring
 *   case); at most CreatorPreset::MAX_PER_OWNER presets each.
 *   Every query is limited to the signed-in account and the section (another account's preset,
 *   template or set = 404 / 422 like a missing one, also for the sysadmin).
 * @note Photos of the computer are never part of a preset - they never leave the browser.
 * @dependencies CreatorPreset, CreatorTemplate, CreatorSet, CreatorAsset, PresetValues,
 *   SavePresetRequest, PresetResource, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\SavePresetRequest;
use App\Apps\JsCreator\Http\Resources\PresetResource;
use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorPreset;
use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Support\PresetValues;
use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PresetController extends Controller
{
    use LogsActivity;

    /**
     * @description Presets of one own template (`template_id`) or set (`set_id`) of the section,
     *   by name.
     * @param Request $request `template_id` or `set_id`.
     * @return JsonResponse 200 list; 422 without an owner.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'template_id' => ['required_without:set_id', 'prohibits:set_id', 'integer', 'min:1'],
            'set_id'      => ['required_without:template_id', 'integer', 'min:1'],
        ]);
        $query = $this->presets($request);
        $request->filled('template_id')
            ? $query->where('template_id', (int) $request->query('template_id'))
            : $query->where('set_id', (int) $request->query('set_id'));

        return $this->respond(PresetResource::collection($query->orderBy('name')->get()));
    }

    /**
     * @description New preset of an own template / set.
     * @param SavePresetRequest $request `name`, `template_id` | `set_id`, `values`.
     * @return JsonResponse 201; 422 (owner, name taken, `preset_limit`, values, images).
     */
    public function store(SavePresetRequest $request): JsonResponse
    {
        [$column, $ownerId, $templateIds] = $this->owner($request);
        $owned = $this->presets($request)->where($column, $ownerId);
        if ((clone $owned)->count() >= CreatorPreset::MAX_PER_OWNER) {
            return response()->json([
                'message'    => 'A template or a set has at most ' . CreatorPreset::MAX_PER_OWNER . ' presets.',
                'error_code' => 'preset_limit',
                'errors'     => ['name' => ['A template or a set has at most ' . CreatorPreset::MAX_PER_OWNER . ' presets.']],
            ], 422);
        }
        $this->checkName($owned, (string) $request->input('name'), null);
        $values = $this->checkedValues($request, $templateIds);

        $preset = CreatorPreset::create([
            'user_id' => $request->user()->id,
            'section' => $this->section($request),
            $column   => $ownerId,
            'name'    => $request->input('name'),
            'payload' => $values,
        ]);
        $this->logAction($request, JsCreatorLog::class, 'create', 'Preset', "Preset #{$preset->id} created", $preset->id, 'Preset', ['values']);

        return $this->respond(new PresetResource($preset), 201);
    }

    /**
     * @description Overwrites an own preset (name and values).
     * @param SavePresetRequest $request `name`, `values`.
     * @param string $id Preset.
     * @return JsonResponse 200; 404; 422 (name taken, values, images).
     */
    public function update(SavePresetRequest $request, string $id): JsonResponse
    {
        $preset = $this->presets($request)->findOrFail((int) $id);
        $column = $preset->template_id !== null ? 'template_id' : 'set_id';
        $templateIds = $this->templateIds($request, $column, (int) $preset->{$column});
        $this->checkName($this->presets($request)->where($column, $preset->{$column}), (string) $request->input('name'), $preset->id);
        $values = $this->checkedValues($request, $templateIds);
        $preset->fill(['name' => $request->input('name'), 'payload' => $values])->touch();
        $this->logAction($request, JsCreatorLog::class, 'update', 'Preset', "Preset #{$preset->id} saved", $preset->id, 'Preset', ['values']);

        return $this->respond(new PresetResource($preset->refresh()));
    }

    /**
     * @description Deletes an own preset (for good - presets have no trash).
     * @param Request $request
     * @param string $id Preset.
     * @return JsonResponse 204; 404.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->presets($request)->findOrFail((int) $id)->delete();
        $this->logAction($request, JsCreatorLog::class, 'hard_delete', 'Preset', "Preset #{$id} deleted", (int) $id, 'Preset');

        return response()->json(null, 204);
    }

    /**
     * @description Query of the own presets of the section of the route.
     * @param Request $request Request of the signed-in account.
     * @return Builder
     */
    private function presets(Request $request): Builder
    {
        return CreatorPreset::query()->ownedBy($request->user())->where('section', $this->section($request));
    }

    /**
     * @description Section of the route (route default `section` - never taken from the URL).
     * @param Request $request
     * @return string
     */
    private function section(Request $request): string
    {
        return (string) $request->route('section');
    }

    /**
     * @description Owner of a new preset: an own template / set of the section outside the trash.
     * @param SavePresetRequest $request `template_id` | `set_id`.
     * @return array{0: string, 1: int, 2: int[]} Column, id and the templates whose crops may be stored.
     * @throws ValidationException 422 `template_id` / `set_id`.
     */
    private function owner(SavePresetRequest $request): array
    {
        $column = $request->filled('template_id') ? 'template_id' : 'set_id';
        $id = (int) $request->input($column);
        $exists = ($column === 'template_id' ? CreatorTemplate::query() : CreatorSet::query())
            ->ownedBy($request->user())->where('section', $this->section($request))->whereKey($id)->exists();
        if (!$exists) {
            throw ValidationException::withMessages([$column => $column === 'template_id'
                ? 'The template is not among your templates.' : 'The set is not among your sets.']);
        }

        return [$column, $id, $this->templateIds($request, $column, $id)];
    }

    /**
     * @description Templates whose crops a preset may store: the template itself / the templates of the set.
     * @param Request $request
     * @param string $column `template_id` | `set_id`.
     * @param int $id Template / set.
     * @return int[]
     */
    private function templateIds(Request $request, string $column, int $id): array
    {
        if ($column === 'template_id') {
            return [$id];
        }
        $set = CreatorSet::withTrashed()->ownedBy($request->user())->find($id);

        return $set ? $set->templates()->pluck('js_creator_templates.id')->map(fn ($v) => (int) $v)->all() : [];
    }

    /**
     * @description A name must be unique among the presets of the template / set (ignoring case).
     * @param Builder $owned Presets of the template / set.
     * @param string $name Trimmed name.
     * @param int|null $except The preset being overwritten.
     * @return void
     * @throws ValidationException 422 `name`.
     */
    private function checkName(Builder $owned, string $name, ?int $except): void
    {
        $taken = (clone $owned)->when($except !== null, fn (Builder $q) => $q->whereKeyNot($except))
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists();
        if ($taken) {
            throw ValidationException::withMessages(['name' => 'A preset with this name already exists.']);
        }
    }

    /**
     * @description Values of the raw body checked by PresetValues; the images must be own library
     *   images (or icons) outside the trash.
     * @param SavePresetRequest $request
     * @param int[] $templateIds Templates whose crops may be stored.
     * @return array Checked values.
     * @throws ValidationException 422 `values…`.
     */
    private function checkedValues(SavePresetRequest $request, array $templateIds): array
    {
        $values = $request->presetValues();
        $errors = PresetValues::check($values, $templateIds);
        if ($errors === []) {
            $ids = PresetValues::assetIds($values);
            $own = CreatorAsset::query()->ownedBy($request->user())->whereIn('id', $ids)->pluck('id')->map(fn ($v) => (int) $v)->all();
            foreach ($values['images'] as $key => $assetId) {
                if (!in_array($assetId, $own, true)) {
                    $errors["values.images.{$key}"] = 'The image is not among your library images.';
                }
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $values;
    }
}
