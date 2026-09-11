<?php
/**
 * @file CheckProjectSession.php
 * @path app/Http/Middleware/CheckProjectSession.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Customer-portal session guard - COMPLETELY SEPARATE from Sanctum/
 * CheckPermission (staff auth). Applied to every authenticated public project route
 * (`projects/public/{token}/...`). Two independent checks happen on EVERY request,
 * not just at login:
 * 1) The project (resolved from the PERMANENT `access_token` route param) must still
 *    be `visibility = 'public'` and not soft-deleted - flipping a live project to
 *    'private' therefore locks out an ALREADY-LOGGED-IN customer immediately, on
 *    their very next request, without needing to hunt down and delete their session
 *    row separately. This is the direct fix for consultation note 4.
 * 2) The Bearer token (the 24h-sliding SESSION, distinct from the permanent URL
 *    token) must resolve to a non-expired `web_project_sessions` row belonging to
 *    THIS SAME project - a session issued for project A can never be replayed
 *    against project B's routes, even if somehow guessed (IDOR guard).
 *
 * On success, both the resolved project and session are attached to the request via
 * `$request->attributes` so controllers never need to re-resolve/re-validate them,
 * and the session's expiry is SLID FORWARD (not just checked) - see
 * WebProjectSession::slideExpiry(), the concrete implementation of consultation
 * note 1's "24h of inactivity, not a hard wall-clock timer from login".
 */

namespace App\Http\Middleware;

use App\Models\Core\CoreSecurityEvent;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckProjectSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->route('token');

        $project = WebProject::where('access_token', $token)->first();

        if (!$project || $project->visibility !== 'public') {
            // Stejná odpověď pro "neexistuje" i "je private" - nerozlišujeme,
            // ať odkaz na privátní projekt nejde odlišit od úplně neplatného.
            CoreSecurityEvent::record(
                'project_session_invalid',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'project_unavailable'])
            );

            return response()->json(['message' => 'The project was not found or is not available.'], 404);
        }

        $bearer = $request->bearerToken() ?: $request->input('session_token');
         if (!$bearer) {
             return response()->json(['message' => 'Authentication required.'], 401);
         }

        $session = WebProjectSession::findValidByPlaintextToken($bearer);

        if (!$session || (int) $session->project_id !== (int) $project->id) {
            CoreSecurityEvent::record(
                'project_session_invalid',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'session_mismatch_or_expired', 'project_id' => $project->id])
            );

            return response()->json(['message' => 'The session has expired or is invalid. Please log in again.'], 401);
        }

        $session->slideExpiry();

        $request->attributes->set('current_project', $project);
        $request->attributes->set('current_project_session', $session);

        return $next($request);
    }
}