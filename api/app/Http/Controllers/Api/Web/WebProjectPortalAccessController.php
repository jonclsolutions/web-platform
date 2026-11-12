<?php
/**
 * @file WebProjectPortalAccessController.php
 * @path app/Http/Controllers/Api/Web/WebProjectPortalAccessController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Password-less sign-in to the client portal (next to the password):
 *   - requestCode(): "send me a code" - by login name or e-mail; every matching account of the
 *     project with an e-mail gets a 6-digit code + one-time link (15 min). The answer is always
 *     the same (202), so nobody learns which accounts / e-mails exist;
 *   - loginWithCode(): login name / e-mail + code → session;
 *   - loginWithLink(): one-time link of an e-mail (sign-in code or invitation) → session.
 * @security Codes / links are one-time, hashed (WebProjectLoginCode), a code allows 5 wrong tries,
 *   an account at most 5 codes an hour, the routes are throttled per IP; failures are security
 *   events; nothing secret is logged.
 * @dependencies WebProjectLoginCode, ProjectNotifier, StartsPortalSession, LogsActivity
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Api\Web\Concerns\StartsPortalSession;
use App\Http\Controllers\Controller;
use App\Mail\Web\ProjectAccessMail;
use App\Models\Web\{WebLog, WebProject, WebProjectAccount, WebProjectLoginCode};
use App\Services\Web\ProjectNotifier;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class WebProjectPortalAccessController extends Controller
{
    use LogsActivity;
    use StartsPortalSession;

    /** @description Request fields never written to the log. */
    private const SECRET_KEYS = ['code', 'link', 'identifier'];

    public function __construct(private readonly ProjectNotifier $notifier) {}

    /**
     * @description Sends a sign-in code to the accounts of the login name / e-mail.
     * @param Request $request {identifier: login name or e-mail}
     * @param string $token Access token of the project.
     * @return JsonResponse 202 always (404 only for an unknown / private project)
     */
    public function requestCode(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate(['identifier' => ['required', 'string', 'max:255']]);
        $project = $this->portalProject($request, $token);
        if (!$project) {
            return $this->projectUnavailable();
        }

        $sent = 0;
        foreach ($this->accountsOf($project, $validated['identifier']) as $account) {
            if (!$account->hasEmail()) {
                continue;
            }
            $recent = $account->loginCodes()->where('purpose', WebProjectLoginCode::PURPOSE_LOGIN)
                ->where('created_at', '>', now()->subHour())->count();
            if ($recent >= WebProjectLoginCode::MAX_REQUESTS_PER_HOUR) {
                continue;
            }
            $issued = WebProjectLoginCode::issue($account, WebProjectLoginCode::PURPOSE_LOGIN, $request->ip());
            if ($this->notifier->sendAccess($project, $account, ProjectAccessMail::KIND_LOGIN, $issued, WebProjectLoginCode::LOGIN_TTL_MINUTES)) {
                $sent++;
                $this->logAction($request, WebLog::class, 'portal_code_sent', 'WebProjectPortal',
                    "Sign-in code sent to client account #{$account->id} of project #{$project->id}", $project->id, 'WebProject', self::SECRET_KEYS);
            }
        }

        return response()->json(['message' => 'If the account exists and has an e-mail, a sign-in code was sent.'], 202);
    }

    /**
     * @description Sign-in with a code from the e-mail.
     * @param Request $request {identifier, code}
     * @param string $token Access token of the project.
     * @return JsonResponse session answer | 401
     */
    public function loginWithCode(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'code'       => ['required', 'string', 'max:20'],
        ]);
        $project = $this->portalProject($request, $token);
        if (!$project) {
            return $this->projectUnavailable();
        }

        foreach ($this->accountsOf($project, $validated['identifier']) as $account) {
            $code = WebProjectLoginCode::matchCode($account, $validated['code']);
            if ($code !== null) {
                $code->consume();

                return $this->startPortalSession($request, $project, $account->fresh(), $token, 'code');
            }
        }

        $this->recordFailedSignIn($request, $project, 'code');

        return response()->json(['message' => 'The code is invalid or has expired.'], 401);
    }

    /**
     * @description Sign-in with the one-time link of an e-mail (sign-in code or invitation).
     * @param Request $request {link}
     * @param string $token Access token of the project.
     * @return JsonResponse session answer | 401
     */
    public function loginWithLink(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate(['link' => ['required', 'string', 'max:128']]);
        $project = $this->portalProject($request, $token);
        if (!$project) {
            return $this->projectUnavailable();
        }

        $code = WebProjectLoginCode::findValidLink($project->id, $validated['link']);
        if ($code === null) {
            $this->recordFailedSignIn($request, $project, 'link');

            return response()->json(['message' => 'The link is invalid, was already used or has expired.'], 401);
        }
        $code->consume();

        return $this->startPortalSession($request, $project, $code->account->fresh(), $token,
            $code->purpose === WebProjectLoginCode::PURPOSE_INVITE ? 'invite' : 'link');
    }

    /**
     * @description Accounts of the project by login name (exact, lower case) or e-mail (any case).
     * @param WebProject $project
     * @param string $identifier Login name or e-mail.
     * @return Collection<int, WebProjectAccount>
     */
    private function accountsOf(WebProject $project, string $identifier): Collection
    {
        $value = mb_strtolower(trim($identifier));
        if ($value === '') {
            return collect();
        }

        return $project->accounts()
            ->where(fn ($q) => $q->where('username', $value)->orWhereRaw('LOWER(email) = ?', [$value]))
            ->get();
    }
}
