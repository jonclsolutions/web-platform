<?php
/**
 * @file WebProjectUpdateController.php
 * @path app/Http/Controllers/Api/Web/WebProjectUpdateController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Updates of the supplier for the client (administration): list (drafts too), add,
 *   change (multipart - files added / removed), delete. Publishing (when added or later) shows
 *   the update in the portal and e-mails - once, at the first publication - the client accounts
 *   that turned update notifications on. An update can be taken back to a draft.
 * @security Every update is looked up within the project of the URL (IDOR guard).
 * @dependencies WebProjectUpdate, SaveProjectUpdateRequest, WebProjectUpdateResource, ProjectNotifier, HandlesAttachments, LogsActivity
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\SaveProjectUpdateRequest;
use App\Http\Resources\Web\WebProjectUpdateResource;
use App\Mail\Web\ProjectClientUpdateMail;
use App\Models\Web\{WebLog, WebProject, WebProjectUpdate};
use App\Services\Web\ProjectNotifier;
use App\Traits\{HandlesAttachments, LogsActivity};
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebProjectUpdateController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /** @description Storage folder of the files of updates (private disk). */
    private const ATTACHMENT_FOLDER = 'web/project_updates';

    public function __construct(private readonly ProjectNotifier $notifier) {}

    /**
     * @description Updates of the project, newest first (drafts included).
     * @param int|string $projectId
     * @return JsonResponse
     */
    public function index($projectId): JsonResponse
    {
        $project = WebProject::withTrashed()->findOrFail($projectId);

        return $this->respond(WebProjectUpdateResource::collection($project->updates()->with('attachments')->get()));
    }

    /**
     * @description Adds an update (a draft unless `publish`).
     * @param SaveProjectUpdateRequest $request
     * @param int|string $projectId
     * @return JsonResponse 201 {data: update, meta: {notified}}
     */
    public function store(SaveProjectUpdateRequest $request, $projectId): JsonResponse
    {
        $project = WebProject::findOrFail($projectId);
        $user = $request->user();
        $update = $project->updates()->create([
            'title'        => $request->validated()['title'],
            'body'         => $request->validated()['body'],
            'author_id'    => $user?->id,
            'author_label' => $user?->full_name,
        ]);
        $this->storeAttachments($request, $update, self::ATTACHMENT_FOLDER);
        $notified = $request->boolean('publish') ? $this->publish($project, $update) : 0;

        $this->logAction($request, WebLog::class, 'update_create', 'WebProjectUpdate',
            "Update #{$update->id} added to project #{$project->id}" . ($update->published_at ? " and published ({$notified} client e-mails)" : ' as a draft'),
            $project->id, 'WebProject', ['body', 'attachments']);

        return $this->respond(new WebProjectUpdateResource($update->fresh()->load('attachments')), 201, ['notified' => $notified]);
    }

    /**
     * @description Changes an update: text, files, publish (first publication e-mails) or back to a draft.
     * @param SaveProjectUpdateRequest $request
     * @param int|string $projectId
     * @param int|string $updateId
     * @return JsonResponse {data: update, meta: {notified}}
     */
    public function update(SaveProjectUpdateRequest $request, $projectId, $updateId): JsonResponse
    {
        $update = $this->updateOf($projectId, $updateId);
        $update->fill(array_intersect_key($request->validated(), array_flip(['title', 'body'])));
        $changed = array_keys($update->getDirty());
        $update->save();

        $removeIds = array_map('intval', $request->validated()['remove_attachment_ids'] ?? []);
        if ($removeIds !== []) {
            $this->deleteAttachmentsByIds($update, $removeIds);
            $changed[] = 'files removed';
        }
        if ($request->hasFile('attachments')) {
            $this->storeAttachments($request, $update, self::ATTACHMENT_FOLDER);
            $changed[] = 'files added';
        }

        $notified = 0;
        if ($request->has('publish')) {
            if ($request->boolean('publish') && $update->published_at === null) {
                $notified = $this->publish($update->project, $update);
                $changed[] = "published ({$notified} client e-mails)";
            } elseif (!$request->boolean('publish') && $update->published_at !== null) {
                $update->update(['published_at' => null]);
                $changed[] = 'back to a draft';
            }
        }

        if ($changed !== []) {
            $this->logAction($request, WebLog::class, 'update_update', 'WebProjectUpdate',
                "Update #{$update->id} of project #{$update->project_id}: " . implode(', ', $changed), (int) $update->project_id, 'WebProject', ['body', 'attachments']);
        }

        return $this->respond(new WebProjectUpdateResource($update->fresh()->load('attachments')), 200, ['notified' => $notified]);
    }

    /**
     * @description Deletes an update with its files.
     * @param Request $request
     * @param int|string $projectId
     * @param int|string $updateId
     * @return JsonResponse 204
     */
    public function destroy(Request $request, $projectId, $updateId): JsonResponse
    {
        $update = $this->updateOf($projectId, $updateId);
        $this->deleteAllAttachments($update);
        $update->delete();
        $this->logAction($request, WebLog::class, 'update_delete', 'WebProjectUpdate',
            "Update #{$update->id} of project #{$update->project_id} deleted", (int) $update->project_id, 'WebProject');

        return response()->json(null, 204);
    }

    /**
     * @description Publishes now; the first publication e-mails the subscribed client accounts
     *   (a re-publication after taking it back does not e-mail again).
     * @param WebProject $project
     * @param WebProjectUpdate $update
     * @return int Number of e-mails.
     */
    private function publish(WebProject $project, WebProjectUpdate $update): int
    {
        $first = $update->first_published_at === null;
        $update->forceFill(['published_at' => now(), 'first_published_at' => $update->first_published_at ?? now()])->save();

        return $first ? $this->notifier->notifyClients($project, ProjectClientUpdateMail::KIND_UPDATE, $update->title) : 0;
    }

    /**
     * @description The update of the URL - 404 when it does not belong to the project.
     * @param int|string $projectId
     * @param int|string $updateId
     * @return WebProjectUpdate
     */
    private function updateOf($projectId, $updateId): WebProjectUpdate
    {
        return WebProjectUpdate::where('project_id', (int) $projectId)->findOrFail((int) $updateId);
    }
}
