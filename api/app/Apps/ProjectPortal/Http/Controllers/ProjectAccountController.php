<?php
/**
 * @file ProjectAccountController.php
 * @path app/Apps/ProjectPortal/Http/Controllers/ProjectAccountController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Client accounts of a project portal, managed by the administration (the client can
 *   change nothing but its e-mail and notifications in the portal): list, add (login name, display
 *   name, password typed in or generated, optional prefilled e-mail and its language), change,
 *   password reset, invitation e-mail (one-time sign-in link, also resent), remove. The
 *   notifications are never turned on here.
 *   A password is returned in plaintext exactly once (meta `password`) - only its hash is stored.
 *   A reset and a removal end every session of the account at once.
 * @security Every account action checks that the account belongs to the project of the URL (IDOR
 *   guard). The audit log names accounts by id only (display name and e-mail are personal data,
 *   masked in the data changes - ProjectAccount::AUDIT_MASKED).
 * @dependencies ProjectAccount, Store/UpdateProjectAccountRequest, ResetProjectAccountPasswordRequest,
 *   ProjectAccountResource, LogsActivity
 */

namespace App\Apps\ProjectPortal\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\ProjectPortal\Http\Requests\ResetProjectAccountPasswordRequest;
use App\Apps\ProjectPortal\Http\Requests\StoreProjectAccountRequest;
use App\Apps\ProjectPortal\Http\Requests\UpdateProjectAccountRequest;
use App\Apps\ProjectPortal\Http\Resources\ProjectAccountResource;
use App\Apps\ProjectPortal\Mail\ProjectAccessMail;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectAccount;
use App\Apps\ProjectPortal\Models\ProjectLoginCode;
use App\Apps\ProjectPortal\Services\ProjectNotifier;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectAccountController extends Controller
{
    use LogsActivity;

    /**
     * @description Request fields never copied into the audit log: the password (secret) and
     *   the personal data of the client (the log names the account by id only).
     */
    private const LOG_EXCLUDED = ['password', 'display_name', 'email'];

    public function __construct(private readonly ProjectNotifier $notifier) {}

    /**
     * @description Accounts of the project (oldest first) with the number of signed-in devices.
     * @param int|string $projectId
     * @return JsonResponse
     */
    public function index($projectId): JsonResponse
    {
        $project = Project::withTrashed()->findOrFail($projectId);
        $accounts = $project->accounts()
            ->withCount(['sessions as active_sessions_count' => fn ($q) => $q->where('expires_at', '>', now())])
            ->get();

        return $this->respond(ProjectAccountResource::collection($accounts));
    }

    /**
     * @description Adds an account. Access: a password (typed in or generated; `with_password`
     *   false = none) and / or an invitation e-mail with a one-time sign-in link (`send_invitation`).
     *   At least one of them is needed (422). The plaintext password is in meta `password` of this
     *   answer only; meta `invited` says whether the invitation went out.
     * @param StoreProjectAccountRequest $request
     * @param int|string $projectId
     * @return JsonResponse 201 {data: account, meta: {password, invited}}
     */
    public function store(StoreProjectAccountRequest $request, $projectId): JsonResponse
    {
        $project = Project::findOrFail($projectId);
        $validated = $request->validated();
        $invite = $request->boolean('send_invitation');
        $withPassword = $request->boolean('with_password', true) || !empty($validated['password']);
        if (!$withPassword && !$invite) {
            return response()->json([
                'message' => 'The account needs a password or an invitation e-mail.',
                'errors'  => ['with_password' => ['The account needs a password or an invitation e-mail.']],
            ], 422);
        }
        $password = $withPassword ? ($validated['password'] ?? null ?: ProjectAccount::generatePassword()) : null;

        $account = new ProjectAccount([
            'project_id'   => $project->id,
            'username'     => $validated['username'],
            'display_name' => $validated['display_name'],
            'email'        => $validated['email'] ?? null,
            'language'     => $validated['language'] ?? 'cz',
        ]);
        if ($password !== null) {
            $account->setPassword($password);
        }
        $account->save();
        $invited = $invite && $this->sendInvitation($request, $project, $account);

        $this->logAction($request, ProjectPortalLog::class, 'account_create', 'ProjectAccount',
            "Portal account #{$account->id} added to project #{$project->id}" . ($password ? ' with a password' : '') . ($invited ? ', invitation sent' : ''),
            $project->id, 'Project', self::LOG_EXCLUDED);

        return $this->respond(new ProjectAccountResource($account->fresh()), 201, ['password' => $password, 'invited' => $invited]);
    }

    /**
     * @description (Re)sends the invitation: a new one-time sign-in link valid 7 days (the older
     *   unused one stops working). 422 without an e-mail, 503 when the e-mail could not be sent.
     * @param Request $request
     * @param int|string $projectId
     * @param int|string $accountId
     * @return JsonResponse The account (invited_at).
     */
    public function invite(Request $request, $projectId, $accountId): JsonResponse
    {
        $account = $this->accountOf($projectId, $accountId);
        if (!$account->hasEmail()) {
            return response()->json(['message' => 'The account has no e-mail.', 'errors' => ['email' => ['The account has no e-mail.']]], 422);
        }
        $project = Project::findOrFail($projectId);
        if (!$this->sendInvitation($request, $project, $account)) {
            return response()->json(['message' => 'The invitation could not be sent. Try again later.'], 503);
        }
        $this->logAction($request, ProjectPortalLog::class, 'account_invite', 'ProjectAccount',
            "Invitation sent to portal account #{$account->id} of project #{$project->id}", $project->id, 'Project');

        return $this->respond(new ProjectAccountResource($account->fresh()));
    }

    /**
     * @description Issues the invitation link and e-mails it; stamps invited_at when sent.
     * @param Request $request
     * @param Project $project
     * @param ProjectAccount $account
     * @return bool Sent.
     */
    private function sendInvitation(Request $request, Project $project, ProjectAccount $account): bool
    {
        $issued = ProjectLoginCode::issue($account, ProjectLoginCode::PURPOSE_INVITE, $request->ip());
        $sent = $this->notifier->sendAccess($project, $account, ProjectAccessMail::KIND_INVITE, $issued, ProjectLoginCode::INVITE_TTL_MINUTES);
        if ($sent) {
            $account->forceFill(['invited_at' => now()])->save();
        }

        return $sent;
    }

    /**
     * @description Changes login name / display name / e-mail / language. A changed or removed
     *   e-mail turns the client's notifications off (the client turns them on again for the new
     *   address in the portal - no e-mail goes to an address the client did not confirm).
     * @param UpdateProjectAccountRequest $request
     * @param int|string $projectId
     * @param int|string $accountId
     * @return JsonResponse
     */
    public function update(UpdateProjectAccountRequest $request, $projectId, $accountId): JsonResponse
    {
        $account = $this->accountOf($projectId, $accountId);
        $validated = $request->validated();
        if (array_key_exists('email', $validated)) {
            $validated['email'] = $validated['email'] ?: null;
        }
        $account->fill($validated);
        if ($account->isDirty('email')) {
            $account->disableNotifications();
        }

        $changed = array_keys(array_diff_key($account->getDirty(), array_flip(['updated_at'])));
        $account->save();

        if ($changed !== []) {
            $this->logAction($request, ProjectPortalLog::class, 'account_update', 'ProjectAccount',
                "Portal account #{$account->id} of project #{$account->project_id} changed: " . implode(', ', $changed), (int) $account->project_id, 'Project', self::LOG_EXCLUDED);
        }

        return $this->respond(new ProjectAccountResource($account->fresh()));
    }

    /**
     * @description New password (typed in or generated) - every session of the account ends. The
     *   plaintext password is in meta `password` of this answer only.
     * @param ResetProjectAccountPasswordRequest $request
     * @param int|string $projectId
     * @param int|string $accountId
     * @return JsonResponse {data: account, meta: {password, ended_sessions}}
     */
    public function resetPassword(ResetProjectAccountPasswordRequest $request, $projectId, $accountId): JsonResponse
    {
        $account = $this->accountOf($projectId, $accountId);
        $password = $request->validated()['password'] ?? null ?: ProjectAccount::generatePassword();

        $account->setPassword($password);
        $account->save();
        $ended = $account->sessions()->delete();

        $this->logAction($request, ProjectPortalLog::class, 'account_password_reset', 'ProjectAccount',
            "Password of portal account #{$account->id} of project #{$account->project_id} reset ({$ended} sessions ended)", (int) $account->project_id, 'Project', self::LOG_EXCLUDED);

        return $this->respond(new ProjectAccountResource($account), 200, ['password' => $password, 'ended_sessions' => $ended]);
    }

    /**
     * @description Removes the account and ends its sessions; its messages stay in the
     *   conversations under the stored name.
     * @param Request $request
     * @param int|string $projectId
     * @param int|string $accountId
     * @return JsonResponse 204
     */
    public function destroy(Request $request, $projectId, $accountId): JsonResponse
    {
        $account = $this->accountOf($projectId, $accountId);
        $account->sessions()->delete();
        $account->delete();

        $this->logAction($request, ProjectPortalLog::class, 'account_delete', 'ProjectAccount',
            "Portal account #{$account->id} removed from project #{$account->project_id}", (int) $account->project_id, 'Project');

        return response()->json(null, 204);
    }

    /**
     * @description The account of the URL - 404 when it does not belong to the project of the URL.
     * @param int|string $projectId
     * @param int|string $accountId
     * @return ProjectAccount
     */
    private function accountOf($projectId, $accountId): ProjectAccount
    {
        return ProjectAccount::where('project_id', (int) $projectId)->findOrFail((int) $accountId);
    }
}
