<?php
/**
 * @file WebProjectPublicController.php
 * @path app/Http/Controllers/Api/Web/WebProjectPublicController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Customer-facing endpoints. `login()` is the ONLY unauthenticated
 * action - everything else sits behind `project.session` middleware.
 *
 * @refactor-note (2026-08-29) BACKLOG "notify by e-mail about customer activity":
 * `threadStore()` and `messageStore()` send a notification to `$project->contact_email`
 * after a successful creation (IF it's filled in - otherwise it's silently skipped,
 * see `notifyProjectContact()`). Sent EVERY time (no debounce) - both when a new
 * thread is opened and on every subsequent message in the "ping-pong". `Mail::queue()`
 * is wrapped in try/catch - a failed e-mail send (SMTP outage etc.) must never break
 * the response to the customer who just successfully sent a message.
 *
 * @refactor-note (2026-09-08) BACKLOG "backend fully in English": all response
 * messages and log strings in this file translated from Czech.
 *
 * @bugfix-note (2026-09-08) BACKLOG "admin UI language independence for chat
 * author labels": `author_label` for CUSTOMER messages is now stored as `null`
 * instead of a hardcoded display string ("Zákazník"/"Customer") - a hardcoded
 * value here would always win over the frontend's own translated fallback
 * (`msg.author_label || threadAuthorLabel(msg.author_type)` in
 * `ProjectsComponent`), permanently showing the SAME language regardless of the
 * admin's currently selected UI language. With `null`, the frontend resolves the
 * generic "Customer" label itself via `t()`, respecting the active language.
 * Admin replies (see `WebProjectThreadController::reply()`) are UNAFFECTED - they
 * store the acting admin's real e-mail, which is actual data, not a generic label,
 * so it should never be translated.
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Web\WebProject\{ProjectLoginRequest, StoreProjectThreadRequest, StoreProjectThreadMessageRequest};
use App\Http\Resources\Web\{WebProjectPublicResource, WebProjectThreadResource};
use App\Mail\Web\ProjectThreadActivityMail;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Web\{WebProject, WebProjectSession, WebProjectThread};
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class WebProjectPublicController extends Controller
{
    public function login(ProjectLoginRequest $request, string $token): JsonResponse
    {
        $project = WebProject::where('access_token', $token)->first();

        if (!$project || $project->visibility !== 'public') {
            CoreSecurityEvent::record(
                'project_login_invalid_token',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['reason' => 'project_unavailable'])
            );
            return response()->json(['message' => 'Project not found or unavailable.'], 404);
        }

        if (!$project->verifyPassword($request->validated()['password'])) {
            CoreSecurityEvent::record(
                'project_login_failed',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['project_id' => $project->id])
            );
            return response()->json(['message' => 'Invalid password.'], 401);
        }

        $sessionToken = WebProjectSession::issueFor($project, $request->ip(), $request->userAgent());

        return response()->json([
            'session_token' => $sessionToken,
            'expires_in'    => WebProjectSession::LIFETIME_MINUTES * 60,
            'project'       => new WebProjectPublicResource($project->load('checkpoints')),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        return response()->json(new WebProjectPublicResource($project->load('checkpoints')));
    }

    public function logout(Request $request): JsonResponse
    {
        $session = $request->attributes->get('current_project_session');
        $session?->delete();

        return response()->json(['message' => 'Logout successful.']);
    }

    public function threadsIndex(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threads = $project->threads()->with('messages')->get();

        return response()->json(WebProjectThreadResource::collection($threads));
    }

    public function threadShow(Request $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->with('messages')->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        return response()->json(new WebProjectThreadResource($thread));
    }

    /**
     * @bugfix-note (2026-09-08) `author_label` for the customer's first message is
     * now `null` - see file header. Frontend resolves the generic label itself.
     */
    public function threadStore(StoreProjectThreadRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $validated = $request->validated();

        $thread = $project->threads()->create([
            'subject'         => $validated['subject'],
            'priority'        => $validated['priority'],
            'status'          => 'active',
            'opened_by'       => 'customer',
            'last_message_at' => now(),
        ]);

        $thread->messages()->create([
            'author_type'  => 'customer',
            'author_label' => null,
            'body'         => $validated['body'],
        ]);

        $this->notifyProjectContact($project, $thread, isNewThread: true);

        return response()->json(new WebProjectThreadResource($thread->load('messages')), 201);
    }

    /**
     * @bugfix-note (2026-09-08) `author_label` for customer messages is now `null` -
     * see file header.
     */
    public function messageStore(StoreProjectThreadMessageRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $message = $thread->messages()->create([
            'author_type'  => 'customer',
            'author_label' => null,
            'body'         => $request->validated()['body'],
        ]);

        $thread->update(['last_message_at' => now()]);

        $this->notifyProjectContact($project, $thread, isNewThread: false);

        return response()->json($message, 201);
    }

    public function threadClose(Request $request, $threadId): JsonResponse
    {
        $project = $request->attributes->get('current_project');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Thread not found.'], 404);
        }

        $thread->update(['status' => 'closed']);

        return response()->json(new WebProjectThreadResource($thread->fresh()));
    }

    /**
     * @description Sends a notification to `$project->contact_email` if it's filled
     * in - otherwise nothing happens silently (no error, no log). A failure to send
     * (SMTP outage etc.) is swallowed and logged, and must never break the response
     * to a customer who just successfully sent a message/opened a thread.
     */
    private function notifyProjectContact(WebProject $project, WebProjectThread $thread, bool $isNewThread): void
    {
        if (empty($project->contact_email)) {
            return;
        }

        try {
            Mail::to($project->contact_email)->queue(
                new ProjectThreadActivityMail($project, $thread, $isNewThread)
            );
        } catch (\Throwable $e) {
            Log::error('Sending project thread activity notification failed: ' . $e->getMessage(), [
                'project_id' => $project->id,
                'thread_id'  => $thread->id,
            ]);
        }
    }
}