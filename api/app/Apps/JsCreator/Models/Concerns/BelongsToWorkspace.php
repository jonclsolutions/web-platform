<?php
/**
 * @file BelongsToWorkspace.php
 * @path app/Apps/JsCreator/Models/Concerns/BelongsToWorkspace.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Records of the private workspace of one account (`user_id`). Every query of a
 *   controller starts with `ownedBy()`, so a record of another account is never found (404) -
 *   without an exception for the sysadmin.
 * @usage `CreatorAsset::ownedBy($request->user())->findOrFail($id)`.
 */

namespace App\Apps\JsCreator\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait BelongsToWorkspace
{
    /**
     * @description Only the records of the given account.
     * @param Builder $query
     * @param User|int $user Account (or its id).
     * @return Builder
     */
    public function scopeOwnedBy(Builder $query, User|int $user): Builder
    {
        return $query->where($this->qualifyColumn('user_id'), $user instanceof User ? $user->id : $user);
    }
}
