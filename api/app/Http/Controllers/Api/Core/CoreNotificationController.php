<?php

/**
 * @file CoreNotificationController.php
 * @path app/Http/Controllers/Api/Core/CoreNotificationController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the administration: for the signed-in admin, the number of
 * unread records of every kind they may see - what came after their last look at the kind (new
 * inquiries, new orders, products that fell under their stock limit …). The kinds come from the
 * notification sources of the core (CoreNotificationSource) and of every registered application
 * (AppManifest::notificationSources()); every kind is returned only to a user with the view
 * permission of its admin page AND the tab permission of its module (NotificationContext, the
 * same rule as the calendar agenda; the sysadmin role sees all). The admin page asks every minute
 * while it is visible (side menu numbers, pop-up notices) and marks a kind as seen when the user
 * opens its page.
 * @note A kind the user has never looked at starts at the first request (a first look is stored),
 *   so a new account or a new kind does not count old records.
 * @note Only numbers and links are returned - never names, e-mails or other content of the records.
 * @dependencies NotificationSource / NotificationContext, AppRegistry, CoreNotificationMark.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreNotificationMark;
use App\Models\User;
use App\Services\Notifications\CoreNotificationSource;
use App\Services\Notifications\NotificationContext;
use App\Services\Notifications\NotificationSource;
use App\Support\Apps\AppRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CoreNotificationController extends Controller
{
    /** @description Tab permission of the core module (frontend CORE_TAB_PERMISSION). */
    private const CORE_TAB_PERMISSION = 'view-core';

    /** @description Most kinds one "seen" request may mark. */
    private const MAX_SEEN_KINDS = 20;

    /**
     * @description Unread counts of every kind the user may see.
     * @param Request $request Signed-in admin.
     * @return JsonResponse { data: { kinds: [{ kind, module, link, count }], checked_at } }
     */
    public function index(Request $request): JsonResponse
    {
        return $this->respond($this->kinds($request->user()));
    }

    /**
     * @description Marks kinds as seen now (the user opened their page) and returns the fresh
     *   counts. Kinds the user may not see are ignored.
     * @param Request $request kinds: list of kind keys (1 to MAX_SEEN_KINDS).
     * @return JsonResponse The same answer as index().
     */
    public function seen(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kinds'   => ['required', 'array', 'min:1', 'max:' . self::MAX_SEEN_KINDS],
            'kinds.*' => ['required', 'string', 'regex:' . NotificationContext::KIND_PATTERN],
        ]);
        $user = $request->user();
        $visible = array_column($this->kinds($user)['kinds'], 'kind');
        $now = now();
        foreach (array_intersect(array_unique($validated['kinds']), $visible) as $kind) {
            CoreNotificationMark::where('user_id', $user->id)->where('kind', $kind)->update(['seen_at' => $now]);
        }

        return $this->respond($this->kinds($user));
    }

    /**
     * @description Kinds of all sources for the user; stores a first look for every kind the user
     *   has never looked at.
     * @param User $user Signed-in admin.
     * @return array{kinds: array<int, array{kind: string, module: string, link: string, count: int}>, checked_at: string}
     */
    private function kinds(User $user): array
    {
        $now = now();
        $permissions = $user->roles()->where('role_name', 'sysadmin')->exists() ? null : ($user->permissions ?? []);
        $seen = CoreNotificationMark::where('user_id', $user->id)->pluck('seen_at', 'kind')
            ->map(fn ($time) => Carbon::parse($time))->all();

        $kinds = [];
        $firstLooks = [];
        foreach ($this->sources() as [$module, $tabPermission, $source]) {
            /** @var NotificationSource $source */
            $context = new NotificationContext($module, $tabPermission, $permissions, $seen, $now);
            foreach ($source->kinds($context) as $kind) {
                $kinds[$kind['kind']] ??= $kind;
            }
            array_push($firstLooks, ...$context->firstLooks());
        }
        foreach (array_unique($firstLooks) as $kind) {
            $mark = new CoreNotificationMark(['kind' => $kind, 'seen_at' => $now]);
            $mark->user_id = $user->id;
            $mark->save();
        }

        return ['kinds' => array_values($kinds), 'checked_at' => $now->toIso8601String()];
    }

    /**
     * @description The notification sources in menu order: every registered application, then the
     *   core - each with its module and tab permission.
     * @return array<int, array{0: string, 1: string, 2: NotificationSource}>
     */
    private function sources(): array
    {
        $sources = [];
        foreach (AppRegistry::notificationSources() as [$app, $source]) {
            $sources[] = [$app->id(), $app->tabPermission(), $source];
        }
        $sources[] = ['core', self::CORE_TAB_PERMISSION, app(CoreNotificationSource::class)];

        return $sources;
    }
}
