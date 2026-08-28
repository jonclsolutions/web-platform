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
 * @refactor-note (2026-08-29) BACKLOG "informovat e-mailem o aktivitě zákazníka":
 * `threadStore()` a `messageStore()` po úspěšném vytvoření pošlou notifikaci na
 * `$project->contact_email` (POKUD je vyplněný - jinak se to tiše přeskočí, viz
 * `notifyProjectContact()`). Odesílá se VŽDY (bez debounce) - jak při založení
 * nového vlákna, tak při každé další zprávě v "ping-pongu". `Mail::queue()`
 * obalený `try/catch` - selhání odeslání e-mailu (SMTP výpadek apod.) nesmí
 * shodit odpověď zákazníkovi, který si právě úspěšně poslal zprávu.
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
            return response()->json(['message' => 'Projekt nebyl nalezen nebo není dostupný.'], 404);
        }

        if (!$project->verifyPassword($request->validated()['password'])) {
            CoreSecurityEvent::record(
                'project_login_failed',
                'warning',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, ['project_id' => $project->id])
            );
            return response()->json(['message' => 'Neplatné heslo.'], 401);
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

        return response()->json(['message' => 'Odhlášení úspěšné.']);
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
            return response()->json(['message' => 'Vlákno nebylo nalezeno.'], 404);
        }

        return response()->json(new WebProjectThreadResource($thread));
    }

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
            'author_label' => 'Zákazník',
            'body'         => $validated['body'],
        ]);

        $this->notifyProjectContact($project, $thread, isNewThread: true);

        return response()->json(new WebProjectThreadResource($thread->load('messages')), 201);
    }

    public function messageStore(StoreProjectThreadMessageRequest $request): JsonResponse
    {
        $project = $request->attributes->get('current_project');
        $threadId = $request->route('threadId');

        $thread = $project->threads()->find($threadId);
        if (!$thread) {
            return response()->json(['message' => 'Vlákno nebylo nalezeno.'], 404);
        }

        $message = $thread->messages()->create([
            'author_type'  => 'customer',
            'author_label' => 'Zákazník',
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
            return response()->json(['message' => 'Vlákno nebylo nalezeno.'], 404);
        }

        $thread->update(['status' => 'closed']);

        return response()->json(new WebProjectThreadResource($thread->fresh()));
    }

    /**
     * @description Pošle notifikaci na `$project->contact_email`, pokud je vyplněný -
     * jinak se tiše nic neděje (žádná chyba, žádný log). Chyba samotného odeslání
     * (SMTP výpadek apod.) se pohltí a zaloguje, nikdy nesmí shodit odpověď
     * zákazníkovi, který si právě úspěšně odeslal zprávu/založil vlákno.
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
            Log::error('Odeslání notifikace o aktivitě ve vlákně projektu selhalo: ' . $e->getMessage(), [
                'project_id' => $project->id,
                'thread_id'  => $thread->id,
            ]);
        }
    }
}