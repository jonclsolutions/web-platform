<?php
/**
 * @file WebProjectApprovalController.php
 * @path app/Http/Controllers/Api/Web/WebProjectApprovalController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Approval requests for the client (administration): list with the history of
 *   decisions, add (title, description, files, optional checkpoint and due date - e-mails the
 *   client accounts that turned approval notifications on), change while pending, ask again after
 *   changes were requested / after cancelling (pending again, e-mailed again), cancel (hidden from
 *   the client, history kept), delete (only without any decision - otherwise cancel).
 * @security Every request is looked up within the project of the URL (IDOR guard); decisions are
 *   never changed here (they are the client's record).
 * @dependencies WebProjectApproval, SaveProjectApprovalRequest, WebProjectApprovalResource, ProjectNotifier, HandlesAttachments, LogsActivity
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\SaveProjectApprovalRequest;
use App\Http\Resources\Web\WebProjectApprovalResource;
use App\Mail\Web\ProjectClientUpdateMail;
use App\Models\Web\{WebLog, WebProject, WebProjectApproval};
use App\Services\Web\ProjectNotifier;
use App\Traits\{HandlesAttachments, LogsActivity};
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebProjectApprovalController extends Controller
{
    use HandlesAttachments;
    use LogsActivity;

    /** @description Storage folder of the files of approvals (private disk). */
    private const ATTACHMENT_FOLDER = 'web/project_approvals';

    /** @description Relations of the answer. */
    private const WITH = ['attachments', 'decisions', 'checkpoint:id,label'];

    public function __construct(private readonly ProjectNotifier $notifier) {}

    /**
     * @description Approval requests of the project, newest first, cancelled included.
     * @param int|string $projectId
     * @return JsonResponse
     */
    public function index($projectId): JsonResponse
    {
        $project = WebProject::withTrashed()->findOrFail($projectId);

        return $this->respond(WebProjectApprovalResource::collection($project->approvals()->with(self::WITH)->get()));
    }

    /**
     * @description Asks the client for an approval.
     * @param SaveProjectApprovalRequest $request
     * @param int|string $projectId
     * @return JsonResponse 201 {data, meta: {notified}}
     */
    public function store(SaveProjectApprovalRequest $request, $projectId): JsonResponse
    {
        $project = WebProject::findOrFail($projectId);
        $user = $request->user();
        $validated = $request->validated();
        $approval = $project->approvals()->create([
            'title'              => $validated['title'],
            'description'        => $validated['description'] ?? null,
            'checkpoint_id'      => $validated['checkpoint_id'] ?? null,
            'due_date'           => $validated['due_date'] ?? null,
            'status'             => WebProjectApproval::STATUS_PENDING,
            'requested_by'       => $user?->id,
            'requested_by_label' => $user?->full_name,
            'requested_at'       => now(),
        ]);
        $this->storeAttachments($request, $approval, self::ATTACHMENT_FOLDER);
        $notified = $this->notifier->notifyClients($project, ProjectClientUpdateMail::KIND_APPROVAL, $approval->title);

        $this->logAction($request, WebLog::class, 'approval_create', 'WebProjectApproval',
            "Approval #{$approval->id} requested in project #{$project->id} ({$notified} client e-mails)", $project->id, 'WebProject', ['description', 'attachments']);

        return $this->respond(new WebProjectApprovalResource($approval->load(self::WITH)), 201, ['notified' => $notified]);
    }

    /**
     * @description Changes a pending request (text, checkpoint, due date, files); 422 otherwise.
     * @param SaveProjectApprovalRequest $request
     * @param int|string $projectId
     * @param int|string $approvalId
     * @return JsonResponse
     */
    public function update(SaveProjectApprovalRequest $request, $projectId, $approvalId): JsonResponse
    {
        $approval = $this->approvalOf($projectId, $approvalId);
        if ($approval->status !== WebProjectApproval::STATUS_PENDING) {
            return $this->notPending('Only a pending approval can be changed - ask again first.');
        }
        $approval->fill(array_intersect_key($request->validated(), array_flip(['title', 'description', 'checkpoint_id', 'due_date'])));
        $changed = array_keys($approval->getDirty());
        $approval->save();
        $removeIds = array_map('intval', $request->validated()['remove_attachment_ids'] ?? []);
        if ($removeIds !== []) {
            $this->deleteAttachmentsByIds($approval, $removeIds);
            $changed[] = 'files removed';
        }
        if ($request->hasFile('attachments')) {
            $this->storeAttachments($request, $approval, self::ATTACHMENT_FOLDER);
            $changed[] = 'files added';
        }
        if ($changed !== []) {
            $this->logAction($request, WebLog::class, 'approval_update', 'WebProjectApproval',
                "Approval #{$approval->id} of project #{$approval->project_id} changed: " . implode(', ', $changed), (int) $approval->project_id, 'WebProject', ['description', 'attachments']);
        }

        return $this->respond(new WebProjectApprovalResource($approval->fresh()->load(self::WITH)));
    }

    /**
     * @description Asks again (after changes were requested / after cancelling): pending again,
     *   the client accounts are e-mailed again. 422 for a pending / approved one.
     * @param Request $request
     * @param int|string $projectId
     * @param int|string $approvalId
     * @return JsonResponse {data, meta: {notified}}
     */
    public function reopen(Request $request, $projectId, $approvalId): JsonResponse
    {
        $approval = $this->approvalOf($projectId, $approvalId);
        if (!in_array($approval->status, [WebProjectApproval::STATUS_CHANGES, WebProjectApproval::STATUS_CANCELLED], true)) {
            return $this->notPending('Only an approval with requested changes or a cancelled one can be requested again.');
        }
        $approval->update(['status' => WebProjectApproval::STATUS_PENDING, 'requested_at' => now(), 'decided_at' => null]);
        $notified = $this->notifier->notifyClients($approval->project, ProjectClientUpdateMail::KIND_APPROVAL, $approval->title);
        $this->logAction($request, WebLog::class, 'approval_reopen', 'WebProjectApproval',
            "Approval #{$approval->id} of project #{$approval->project_id} requested again ({$notified} client e-mails)", (int) $approval->project_id, 'WebProject');

        return $this->respond(new WebProjectApprovalResource($approval->fresh()->load(self::WITH)), 200, ['notified' => $notified]);
    }

    /**
     * @description Cancels a pending request / one with requested changes (hidden from the client).
     * @param Request $request
     * @param int|string $projectId
     * @param int|string $approvalId
     * @return JsonResponse
     */
    public function cancel(Request $request, $projectId, $approvalId): JsonResponse
    {
        $approval = $this->approvalOf($projectId, $approvalId);
        if (!in_array($approval->status, [WebProjectApproval::STATUS_PENDING, WebProjectApproval::STATUS_CHANGES], true)) {
            return $this->notPending('An approved or cancelled approval cannot be cancelled.');
        }
        $approval->update(['status' => WebProjectApproval::STATUS_CANCELLED]);
        $this->logAction($request, WebLog::class, 'approval_cancel', 'WebProjectApproval',
            "Approval #{$approval->id} of project #{$approval->project_id} cancelled", (int) $approval->project_id, 'WebProject');

        return $this->respond(new WebProjectApprovalResource($approval->fresh()->load(self::WITH)));
    }

    /**
     * @description Deletes a request without any decision (with its files); one with a decision
     *   is the client's record and can only be cancelled (422).
     * @param Request $request
     * @param int|string $projectId
     * @param int|string $approvalId
     * @return JsonResponse 204
     */
    public function destroy(Request $request, $projectId, $approvalId): JsonResponse
    {
        $approval = $this->approvalOf($projectId, $approvalId);
        if ($approval->decisions()->exists()) {
            return $this->notPending('An approval with a decision of the client cannot be deleted - cancel it instead.');
        }
        $this->deleteAllAttachments($approval);
        $approval->delete();
        $this->logAction($request, WebLog::class, 'approval_delete', 'WebProjectApproval',
            "Approval #{$approval->id} of project #{$approval->project_id} deleted", (int) $approval->project_id, 'WebProject');

        return response()->json(null, 204);
    }

    /**
     * @description 422 answer for an action the state does not allow.
     * @param string $message
     * @return JsonResponse
     */
    private function notPending(string $message): JsonResponse
    {
        return response()->json(['message' => $message, 'errors' => ['status' => [$message]]], 422);
    }

    /**
     * @description The approval of the URL - 404 when it does not belong to the project.
     * @param int|string $projectId
     * @param int|string $approvalId
     * @return WebProjectApproval
     */
    private function approvalOf($projectId, $approvalId): WebProjectApproval
    {
        return WebProjectApproval::where('project_id', (int) $projectId)->findOrFail((int) $approvalId);
    }
}
