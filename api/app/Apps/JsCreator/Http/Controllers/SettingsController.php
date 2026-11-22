<?php
/**
 * @file SettingsController.php
 * @path app/Apps/JsCreator/Http/Controllers/SettingsController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings of JS Creator: the default quota of an account, the overview of the
 *   accounts (those with access to the application and those that still have data in it) and
 *   their individual quotas. The overview shows only numbers - never names or content of a
 *   workspace (nobody, not even the sysadmin, sees another workspace).
 * @dependencies CreatorSetting, CreatorUserQuota, WorkspaceQuota, the workspace models, User
 *   (roles, explicit permissions), LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Http\Requests\UpdateSettingsRequest;
use App\Apps\JsCreator\Http\Requests\UpdateUserQuotaRequest;
use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\CreatorSetting;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUserQuota;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Services\WorkspaceQuota;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class SettingsController extends Controller
{
    use LogsActivity;

    /** @description Permission that opens the application (access). */
    private const TAB_PERMISSION = 'view-js-creator';

    /** @description Role with every permission. */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /**
     * @description The settings.
     * @return JsonResponse { default_quota_mb }
     */
    public function show(): JsonResponse
    {
        return $this->respond(['default_quota_mb' => CreatorSetting::current()->default_quota_mb]);
    }

    /**
     * @description Changes the default quota.
     * @param UpdateSettingsRequest $request `default_quota_mb`.
     * @return JsonResponse { default_quota_mb }
     */
    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $settings = CreatorSetting::current();
        $old = $settings->default_quota_mb;
        $settings->default_quota_mb = (int) $request->input('default_quota_mb');
        $settings->save();
        $this->logAction($request, JsCreatorLog::class, 'update', 'Settings', "Default quota changed: {$old} MB → {$settings->default_quota_mb} MB");

        return $this->respond(['default_quota_mb' => $settings->default_quota_mb]);
    }

    /**
     * @description Accounts with access to the application or with data in it, by name: usage,
     *   counts and quota.
     * @return JsonResponse list of { id, name, has_access, used_bytes, quota_mb, quota_bytes, counts }
     *   (counts: folders, images, fonts, templates, outputs)
     */
    public function users(): JsonResponse
    {
        $withAccess = $this->accountsWithAccess()->pluck('id');
        $withData = collect([CreatorAsset::class, CreatorFont::class, CreatorFolder::class, CreatorTemplate::class, CreatorOutput::class])
            ->flatMap(fn (string $model) => $model::withTrashed()->distinct()->pluck('user_id'));
        $users = User::query()->whereIn('id', $withAccess->merge($withData)->unique()->values())->orderBy('full_name')->get(['id', 'full_name']);

        $rows = $this->usageRows($users, $withAccess);

        return $this->respond($rows);
    }

    /**
     * @description Sets (or with null removes) the individual quota of an account.
     * @param UpdateUserQuotaRequest $request `quota_mb` (null = default).
     * @param string $id Account.
     * @return JsonResponse the row of the account as in users(); 404 unknown account.
     */
    public function updateQuota(UpdateUserQuotaRequest $request, string $id): JsonResponse
    {
        $user = User::query()->findOrFail((int) $id);
        $old = WorkspaceQuota::individualMb($user->id);
        $new = $request->input('quota_mb');
        if ($new === null) {
            CreatorUserQuota::query()->whereKey($user->id)->delete();
        } else {
            CreatorUserQuota::query()->updateOrCreate(['user_id' => $user->id], ['quota_mb' => (int) $new]);
        }
        $this->logAction($request, JsCreatorLog::class, 'update', 'Quota',
            'Quota of account #' . $user->id . ' changed: ' . ($old === null ? 'default' : "{$old} MB") . ' → ' . ($new === null ? 'default' : ((int) $new) . ' MB'),
            $user->id, 'User');

        return $this->respond($this->usageRows(collect([$user]), $this->accountsWithAccess()->whereKey($user->id)->pluck('id'))[0]);
    }

    /**
     * @description Accounts that may open the application: the sysadmin role, or the tab
     *   permission through a role or an explicit grant.
     * @return Builder
     */
    private function accountsWithAccess(): Builder
    {
        return User::query()->where(fn (Builder $q) => $q
            ->whereHas('roles', fn (Builder $role) => $role->where(fn (Builder $r) => $r
                ->where('role_name', self::SYSADMIN_ROLE_NAME)
                ->orWhereHas('permissions', fn (Builder $p) => $p->where('permission_key', self::TAB_PERMISSION))))
            ->orWhereHas('explicitPermissions', fn (Builder $p) => $p->where('permission_key', self::TAB_PERMISSION)));
    }

    /**
     * @description Usage rows of accounts (sizes include the trash, counts do not).
     * @param Collection<int, User> $users Accounts.
     * @param Collection<int, int> $withAccess Ids of the accounts with access.
     * @return array<int, array<string, mixed>>
     */
    private function usageRows(Collection $users, Collection $withAccess): array
    {
        $ids = $users->pluck('id');
        $bytes = fn (string $model, string $column = 'size_bytes') => $model::withTrashed()->whereIn('user_id', $ids)->groupBy('user_id')
            ->selectRaw("user_id, SUM({$column}) AS total")->pluck('total', 'user_id');
        $counts = fn (string $model) => $model::query()->whereIn('user_id', $ids)->groupBy('user_id')
            ->selectRaw('user_id, COUNT(*) AS total')->pluck('total', 'user_id');
        [$assetBytes, $fontBytes, $thumbBytes, $outputBytes] = [
            $bytes(CreatorAsset::class), $bytes(CreatorFont::class), $bytes(CreatorTemplate::class, 'thumb_bytes'), $bytes(CreatorOutput::class),
        ];
        [$folders, $images, $fonts, $templates, $outputs] = [
            $counts(CreatorFolder::class), $counts(CreatorAsset::class), $counts(CreatorFont::class), $counts(CreatorTemplate::class),
            $counts(CreatorOutput::class),
        ];
        $quotas = CreatorUserQuota::query()->whereIn('user_id', $ids)->pluck('quota_mb', 'user_id');
        $defaultMb = CreatorSetting::current()->default_quota_mb;

        return $users->map(fn (User $user) => [
            'id'          => $user->id,
            'name'        => $user->full_name,
            'has_access'  => $withAccess->contains($user->id),
            'used_bytes'  => (int) ($assetBytes[$user->id] ?? 0) + (int) ($fontBytes[$user->id] ?? 0) + (int) ($thumbBytes[$user->id] ?? 0)
                + (int) ($outputBytes[$user->id] ?? 0),
            'quota_mb'    => isset($quotas[$user->id]) ? (int) $quotas[$user->id] : null,
            'quota_bytes' => (int) ($quotas[$user->id] ?? $defaultMb) * WorkspaceQuota::MB,
            'counts'      => [
                'folders'   => (int) ($folders[$user->id] ?? 0),
                'images'    => (int) ($images[$user->id] ?? 0),
                'fonts'     => (int) ($fonts[$user->id] ?? 0),
                'templates' => (int) ($templates[$user->id] ?? 0),
                'outputs'   => (int) ($outputs[$user->id] ?? 0),
            ],
        ])->values()->all();
    }
}
