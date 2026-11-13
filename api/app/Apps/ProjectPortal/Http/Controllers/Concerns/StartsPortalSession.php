<?php
/**
 * @file StartsPortalSession.php
 * @path app/Apps/ProjectPortal/Http/Controllers/Concerns/StartsPortalSession.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared steps of every sign-in to the client portal (password, one-time code,
 *   one-time link / invitation): finding the public project of the link (a security event for an
 *   unknown / private one) and starting the session of the account - the session token only in
 *   the HttpOnly cookie limited to the routes of the project, the sign-in logged by account id
 *   and method.
 * @dependencies Project, ProjectSession, ProjectPublicResource, PortalCookie, CoreSecurityEvent, LogsActivity
 */

namespace App\Apps\ProjectPortal\Http\Controllers\Concerns;

use App\Apps\ProjectPortal\Http\Resources\ProjectPublicResource;
use App\Models\Core\CoreSecurityEvent;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectAccount;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Support\PortalCookie;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait StartsPortalSession
{
    /**
     * @description The public project of the portal link, or null (security event recorded).
     * @param Request $request
     * @param string $token Permanent access token of the project.
     * @return Project|null
     */
    protected function portalProject(Request $request, string $token): ?Project
    {
        $project = Project::where('access_token', $token)->first();
        if ($project && $project->visibility === 'public') {
            return $project;
        }
        CoreSecurityEvent::record('project_login_invalid_token', 'warning', $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, ['reason' => 'project_unavailable']));

        return null;
    }

    /**
     * @description 404 answer of an unknown / private project.
     * @return JsonResponse
     */
    protected function projectUnavailable(): JsonResponse
    {
        return response()->json(['message' => 'Project not found or unavailable.'], 404);
    }

    /**
     * @description Records a failed sign-in (security event).
     * @param Request $request
     * @param Project $project
     * @param string $method password | code | link
     * @return void
     */
    protected function recordFailedSignIn(Request $request, Project $project, string $method): void
    {
        CoreSecurityEvent::record('project_login_failed', 'warning', $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, ['project_id' => $project->id, 'method' => $method]));
    }

    /**
     * @description Starts the session of the account: session row, last sign-in, log row, answer
     *   with the project (and the account) + the session cookie.
     * @param Request $request
     * @param Project $project
     * @param ProjectAccount $account
     * @param string $token Access token of the project (cookie path).
     * @param string $method password | code | link | invite
     * @return JsonResponse
     */
    protected function startPortalSession(Request $request, Project $project, ProjectAccount $account, string $token, string $method): JsonResponse
    {
        $sessionToken = ProjectSession::issueFor($account, $request->ip(), $request->userAgent());
        $account->forceFill(['last_login_at' => now()])->save();
        $request->attributes->set('current_project_account', $account);
        $this->logAction($request, ProjectPortalLog::class, 'portal_login', 'ProjectPortal',
            "Client account #{$account->id} signed in to the portal of project #{$project->id} ({$method})", $project->id, 'Project',
            ['password', 'code', 'link', 'identifier']);

        return $this->respond([
            'expires_in' => ProjectSession::LIFETIME_MINUTES * 60,
            'project'    => (new ProjectPublicResource($project->load('checkpoints')))->resolve($request),
        ])->withCookie(PortalCookie::issue($request, $token, $sessionToken));
    }
}
