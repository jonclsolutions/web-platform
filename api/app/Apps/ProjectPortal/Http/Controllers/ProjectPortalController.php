<?php
/**
 * @file ProjectPortalController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/ProjectPortalController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Phase 2 content of the client portal (signed-in account, CheckProjectSession):
 *   - activity(): "What is new" - the supplier's activity with the items new since the account
 *     last looked (`meta.unseen`), markActivitySeen() stores that moment;
 *   - updates(): published updates of the supplier with their files;
 *   - approvals() / decide(): approval requests (not cancelled) with files and the history of
 *     decisions; the client approves a pending one or requests changes (comment required). The
 *     decision keeps who and when; the team is e-mailed.
 * @security Every item is looked up within the project of the session (no access to another
 *   project); the comment is not written to the audit log (it is kept in the decision itself).
 * @dependencies ProjectActivityFeed, ProjectNotifier, ProjectUpdate, ProjectApproval, LogsActivity
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\ProjectPortal\Http\Resources\ProjectApprovalResource;
use App\Apps\ProjectPortal\Http\Resources\ProjectUpdateResource;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectApproval;
use App\Apps\ProjectPortal\Services\ProjectActivityFeed;
use App\Apps\ProjectPortal\Services\ProjectNotifier;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProjectPortalController extends Controller
{
    use LogsActivity;

    public function __construct(
        private readonly ProjectActivityFeed $feed,
        private readonly ProjectNotifier $notifier,
    ) {}

    /**
     * @description "What is new": the supplier's activity, each item flagged `is_new` when newer
     *   than the account's last look (a never-seen account: newer than its creation); the account's
     *   own approval decisions are listed but never new.
     * @param Request $request
     * @return JsonResponse {data: items, meta: {unseen, seen_at}}
     */
    public function activity(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $account = $request->attributes->get('current_project_account');
        $seenAt = $account->news_seen_at ?? $account->created_at;
        $items = $this->feed->build($project, ProjectActivityFeed::AUDIENCE_CLIENT)
            ->map(function (array $item) use ($seenAt, $account) {
                // The account's own approval decision is no news for it.
                $own = ($item[ProjectActivityFeed::DECIDED_BY_KEY] ?? null) === $account->id;
                unset($item[ProjectActivityFeed::DECIDED_BY_KEY]);

                return $item + ['is_new' => !$own && ($seenAt === null || $item['at'] > $seenAt->format('Y-m-d H:i:s'))];
            });

        return $this->respond($items->values(), 200, [
            'unseen'  => $items->where('is_new', true)->count(),
            'seen_at' => $account->news_seen_at?->format('Y-m-d H:i:s'),
        ]);
    }

    /**
     * @description The account has seen the news (now).
     * @param Request $request
     * @return JsonResponse {seen_at}
     */
    public function markActivitySeen(Request $request): JsonResponse
    {
        $account = $request->attributes->get('current_project_account');
        $account->forceFill(['news_seen_at' => now()])->save();

        return $this->respond(['seen_at' => $account->news_seen_at->format('Y-m-d H:i:s')]);
    }

    /**
     * @description Published updates, newest first, with files (fresh signed links).
     * @param Request $request
     * @return JsonResponse
     */
    public function updates(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $updates = $project->updates()->published()->with('attachments')->reorder('published_at', 'desc')->get();

        return $this->respond(ProjectUpdateResource::collection($updates));
    }

    /**
     * @description Approval requests (pending first, then newest), with files, checkpoint and decisions.
     * @param Request $request
     * @return JsonResponse
     */
    public function approvals(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $approvals = $project->approvals()->visibleToClient()->with(['attachments', 'decisions', 'checkpoint:id,label'])->get()
            ->sortBy(fn (ProjectApproval $a) => [$a->status === ProjectApproval::STATUS_PENDING ? 0 : 1, -$a->id])->values();

        return $this->respond(ProjectApprovalResource::collection($approvals));
    }

    /**
     * @description The client's decision on a pending approval: approved, or changes requested
     *   (a comment is required). 422 when the request is not pending any more.
     * @param Request $request {decision, comment}
     * @return JsonResponse The approval.
     */
    public function decide(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $account = $request->attributes->get('current_project_account');
        $validated = $request->validate([
            'decision' => ['required', Rule::in(ProjectApproval::DECISIONS)],
            'comment'  => ['nullable', 'string', 'max:5000', Rule::requiredIf(fn () => $request->input('decision') === ProjectApproval::STATUS_CHANGES)],
        ]);

        $approval = $project->approvals()->visibleToClient()->find($request->route('approvalId'));
        if (!$approval) {
            return response()->json(['message' => 'Approval not found.'], 404);
        }
        if ($approval->status !== ProjectApproval::STATUS_PENDING) {
            return response()->json([
                'message' => 'This approval is not waiting for a decision.',
                'errors'  => ['decision' => ['This approval is not waiting for a decision.']],
            ], 422);
        }

        DB::transaction(function () use ($approval, $account, $validated) {
            $approval->decisions()->create([
                'decision'     => $validated['decision'],
                'comment'      => isset($validated['comment']) ? trim($validated['comment']) ?: null : null,
                'account_id'   => $account->id,
                'author_label' => $account->display_name,
            ]);
            $approval->update(['status' => $validated['decision'], 'decided_at' => now()]);
        });

        $this->logAction($request, ProjectPortalLog::class, 'portal_approval_decision', 'ProjectPortal',
            "Client account #{$account->id} decided '{$validated['decision']}' on approval #{$approval->id} of project #{$project->id}",
            $project->id, 'Project', ['comment']);
        $this->notifier->notifyApprovalDecided($project, $approval, $validated['decision']);

        return $this->respond(new ProjectApprovalResource($approval->fresh()->load(['attachments', 'decisions', 'checkpoint:id,label'])));
    }
}
