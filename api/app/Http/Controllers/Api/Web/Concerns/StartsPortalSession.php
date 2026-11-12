<?php
/**
 * @file StartsPortalSession.php
 * @path app/Http/Controllers/Api/Web/Concerns/StartsPortalSession.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared steps of every sign-in to the client portal (password, one-time code,
 *   one-time link / invitation): finding the public project of the link (a security event for an
 *   unknown / private one) and starting the session of the account - the session token only in
 *   the HttpOnly cookie limited to the routes of the project, the sign-in logged by account id
 *   and method.
 * @dependencies WebProject, WebProjectSession, WebProjectPublicResource, AuthCookies, CoreSecurityEvent, LogsActivity
 */

namespace App\Http\Controllers\Api\Web\Concerns;

use App\Http\Resources\Web\WebProjectPublicResource;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Web\{WebLog, WebProject, WebProjectAccount, WebProjectSession};
use App\Support\Auth\AuthCookies;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait StartsPortalSession
{
    /**
     * @description The public project of the portal link, or null (security event recorded).
     * @param Request $request
     * @param string $token Permanent access token of the project.
     * @return WebProject|null
     */
    protected function portalProject(Request $request, string $token): ?WebProject
    {
        $project = WebProject::where('access_token', $token)->first();
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
     * @param WebProject $project
     * @param string $method password | code | link
     * @return void
     */
    protected function recordFailedSignIn(Request $request, WebProject $project, string $method): void
    {
        CoreSecurityEvent::record('project_login_failed', 'warning', $request->ip(),
            CoreSecurityEvent::contextFromRequest($request, ['project_id' => $project->id, 'method' => $method]));
    }

    /**
     * @description Starts the session of the account: session row, last sign-in, log row, answer
     *   with the project (and the account) + the session cookie.
     * @param Request $request
     * @param WebProject $project
     * @param WebProjectAccount $account
     * @param string $token Access token of the project (cookie path).
     * @param string $method password | code | link | invite
     * @return JsonResponse
     */
    protected function startPortalSession(Request $request, WebProject $project, WebProjectAccount $account, string $token, string $method): JsonResponse
    {
        $sessionToken = WebProjectSession::issueFor($account, $request->ip(), $request->userAgent());
        $account->forceFill(['last_login_at' => now()])->save();
        $request->attributes->set('current_project_account', $account);
        $this->logAction($request, WebLog::class, 'portal_login', 'WebProjectPortal',
            "Client account #{$account->id} signed in to the portal of project #{$project->id} ({$method})", $project->id, 'WebProject',
            ['password', 'code', 'link', 'identifier']);

        return $this->respond([
            'expires_in' => WebProjectSession::LIFETIME_MINUTES * 60,
            'project'    => (new WebProjectPublicResource($project->load('checkpoints')))->resolve($request),
        ])->withCookie(AuthCookies::portal($request, $token, $sessionToken));
    }
}
