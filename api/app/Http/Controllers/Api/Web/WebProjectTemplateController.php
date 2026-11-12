<?php
/**
 * @file WebProjectTemplateController.php
 * @path app/Http/Controllers/Api/Web/WebProjectTemplateController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Project templates (administration): list, detail, add, change (the checkpoint list
 *   is replaced as a whole), delete; save the checkpoints of a project as a new template; add the
 *   checkpoints of a template to a project (due dates = start + days of the template).
 * @dependencies WebProjectTemplate, WebProjectTemplateCheckpoint, SaveProjectTemplateRequest, LogsActivity
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\SaveProjectTemplateRequest;
use App\Http\Resources\Web\WebProjectCheckpointResource;
use App\Models\Web\{WebLog, WebProject, WebProjectTemplate};
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class WebProjectTemplateController extends Controller
{
    use LogsActivity;

    /**
     * @description Templates by name with their checkpoints.
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        return $this->respond(WebProjectTemplate::with('checkpoints')->orderBy('name')->get()->map(fn ($t) => $this->present($t))->values());
    }

    /**
     * @param int|string $templateId
     * @return JsonResponse
     */
    public function show($templateId): JsonResponse
    {
        return $this->respond($this->present(WebProjectTemplate::with('checkpoints')->findOrFail($templateId)));
    }

    /**
     * @description Adds a template with its checkpoints.
     * @param SaveProjectTemplateRequest $request
     * @return JsonResponse 201
     */
    public function store(SaveProjectTemplateRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $template = DB::transaction(function () use ($validated) {
            $template = WebProjectTemplate::create(['name' => $validated['name'], 'description' => $validated['description'] ?? null]);
            $this->replaceCheckpoints($template, $validated['checkpoints']);

            return $template;
        });
        $this->logAction($request, WebLog::class, 'template_create', 'WebProjectTemplate', "Project template #{$template->id} '{$template->name}' added", $template->id, 'WebProjectTemplate');

        return $this->respond($this->present($template->load('checkpoints')), 201);
    }

    /**
     * @description Changes a template (checkpoints replaced when sent).
     * @param SaveProjectTemplateRequest $request
     * @param int|string $templateId
     * @return JsonResponse
     */
    public function update(SaveProjectTemplateRequest $request, $templateId): JsonResponse
    {
        $template = WebProjectTemplate::findOrFail($templateId);
        $validated = $request->validated();
        DB::transaction(function () use ($template, $validated) {
            $template->update(array_intersect_key($validated, array_flip(['name', 'description'])));
            if (isset($validated['checkpoints'])) {
                $this->replaceCheckpoints($template, $validated['checkpoints']);
            }
        });
        $this->logAction($request, WebLog::class, 'template_update', 'WebProjectTemplate', "Project template #{$template->id} '{$template->name}' changed", $template->id, 'WebProjectTemplate');

        return $this->respond($this->present($template->fresh()->load('checkpoints')));
    }

    /**
     * @param Request $request
     * @param int|string $templateId
     * @return JsonResponse 204
     */
    public function destroy(Request $request, $templateId): JsonResponse
    {
        $template = WebProjectTemplate::findOrFail($templateId);
        $template->delete();
        $this->logAction($request, WebLog::class, 'template_delete', 'WebProjectTemplate', "Project template #{$template->id} '{$template->name}' deleted", (int) $template->id, 'WebProjectTemplate');

        return response()->json(null, 204);
    }

    /**
     * @description Saves the checkpoints of a project as a new template (due dates become days
     *   after the earliest due date / today).
     * @param Request $request {name, description}
     * @param int|string $projectId
     * @return JsonResponse 201
     */
    public function storeFromProject(Request $request, $projectId): JsonResponse
    {
        $validated = $request->validate(['name' => ['required', 'string', 'max:160'], 'description' => ['nullable', 'string', 'max:5000']]);
        $project = WebProject::with('checkpoints')->findOrFail($projectId);
        if ($project->checkpoints->isEmpty()) {
            return response()->json(['message' => 'The project has no checkpoints.', 'errors' => ['name' => ['The project has no checkpoints.']]], 422);
        }
        $start = $project->checkpoints->pluck('due_date')->filter()->min() ?? now();
        $start = Carbon::parse($start)->startOfDay();
        $items = $project->checkpoints->map(fn ($c) => [
            'label'       => $c->label,
            'description' => $c->description,
            'offset_days' => $c->due_date ? max(0, (int) $start->diffInDays(Carbon::parse($c->due_date)->startOfDay(), false)) : null,
        ])->all();

        $template = DB::transaction(function () use ($validated, $items) {
            $template = WebProjectTemplate::create(['name' => $validated['name'], 'description' => $validated['description'] ?? null]);
            $this->replaceCheckpoints($template, $items);

            return $template;
        });
        $this->logAction($request, WebLog::class, 'template_create', 'WebProjectTemplate', "Project template #{$template->id} '{$template->name}' saved from project #{$project->id}", $template->id, 'WebProjectTemplate');

        return $this->respond($this->present($template->load('checkpoints')), 201);
    }

    /**
     * @description Adds the checkpoints of a template at the end of a project.
     * @param Request $request {template_id, start_date}
     * @param int|string $projectId
     * @return JsonResponse The checkpoints of the project, meta.added.
     */
    public function applyToProject(Request $request, $projectId): JsonResponse
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', 'exists:web_project_templates,id'],
            'start_date'  => ['nullable', 'date_format:Y-m-d'],
        ]);
        $project = WebProject::findOrFail($projectId);
        $template = WebProjectTemplate::with('checkpoints')->findOrFail($validated['template_id']);
        $added = DB::transaction(fn () => $template->applyTo($project, isset($validated['start_date']) ? Carbon::parse($validated['start_date']) : null));
        $this->logAction($request, WebLog::class, 'template_apply', 'WebProjectCheckpoint',
            "Template #{$template->id} '{$template->name}' applied to project #{$project->id} ({$added} checkpoints)", $project->id, 'WebProject');

        return $this->respond(WebProjectCheckpointResource::collection($project->checkpoints()->get()), 200, ['added' => $added]);
    }

    /**
     * @description Replaces the checkpoints of a template by the given list (in its order).
     * @param WebProjectTemplate $template
     * @param array<int, array{label: string, description?: string|null, offset_days?: int|null}> $items
     * @return void
     */
    private function replaceCheckpoints(WebProjectTemplate $template, array $items): void
    {
        $template->checkpoints()->delete();
        foreach (array_values($items) as $position => $item) {
            $template->checkpoints()->create([
                'label'       => $item['label'],
                'description' => $item['description'] ?? null,
                'offset_days' => $item['offset_days'] ?? null,
                'sort_order'  => $position,
            ]);
        }
    }

    /**
     * @description Template as returned by the API.
     * @param WebProjectTemplate $template
     * @return array<string, mixed>
     */
    private function present(WebProjectTemplate $template): array
    {
        return [
            'id'          => $template->id,
            'name'        => $template->name,
            'description' => $template->description,
            'checkpoints' => $template->checkpoints->map(fn ($c) => [
                'id' => $c->id, 'label' => $c->label, 'description' => $c->description, 'offset_days' => $c->offset_days, 'sort_order' => $c->sort_order,
            ])->values(),
            'updated_at'  => $template->updated_at?->format('Y-m-d H:i:s'),
        ];
    }
}
