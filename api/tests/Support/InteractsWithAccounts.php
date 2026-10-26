<?php

/**
 * @file InteractsWithAccounts.php
 * @path api/tests/Support/InteractsWithAccounts.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Test helpers for accounts: permissions, roles, users, signing in (Sanctum)
 *   and reading the audit log / security events the tested code writes.
 * @dependencies
 * - App\Models\User, App\Models\Core\{CorePermission, CoreRole, CoreLog, CoreSecurityEvent}
 * - Laravel Sanctum (Sanctum::actingAs).
 */

namespace Tests\Support;

use App\Models\Core\CoreLog;
use App\Models\Core\CorePermission;
use App\Models\Core\CoreRole;
use App\Models\Core\CoreSecurityEvent;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

/**
 * @description Mixed into Tests\TestCase.
 */
trait InteractsWithAccounts
{
    /** @var string Password of every account created by user() unless one is given. */
    protected string $defaultPassword = 'Secret1!';

    /**
     * @description Returns the permission with the given key, creating it when missing.
     * @param string $key Permission key, e.g. 'core-administrators-view'.
     * @param string $module Module the permission belongs to.
     * @return CorePermission
     */
    protected function permission(string $key, string $module = 'core'): CorePermission
    {
        return CorePermission::firstOrCreate(['permission_key' => $key], ['module' => $module, 'description' => $key]);
    }

    /**
     * @description Creates a role with the given permissions (created when missing).
     * @param string $name Role name ('sysadmin' is the protected all-access role).
     * @param string[] $permissionKeys Permission keys granted by the role.
     * @param array<string, mixed> $attributes Extra role columns (description, forces_2fa).
     * @return CoreRole
     */
    protected function role(string $name, array $permissionKeys = [], array $attributes = []): CoreRole
    {
        $role = CoreRole::create(['role_name' => $name] + $attributes);
        $role->permissions()->sync(array_map(fn (string $key) => $this->permission($key)->id, $permissionKeys));

        return $role;
    }

    /**
     * @description Creates an activated account, optionally with a role.
     * @param array<string, mixed> $attributes Column overrides (user_email, is_blocked, …).
     * @param CoreRole|null $role Role to assign.
     * @return User
     */
    protected function user(array $attributes = [], ?CoreRole $role = null): User
    {
        static $sequence = 0;
        $sequence++;

        $user = User::create(array_merge([
            'user_email'         => "user{$sequence}@example.com",
            'full_name'          => "Test User {$sequence}",
            'user_password_hash' => Hash::make($this->defaultPassword),
            'activated_at'       => now(),
        ], $attributes));

        if ($role) {
            $user->roles()->attach($role->id);
        }

        return $user->fresh();
    }

    /**
     * @description Creates an account with the 'sysadmin' role (role created on first use).
     * @param array<string, mixed> $attributes Column overrides.
     * @return User
     */
    protected function sysadmin(array $attributes = []): User
    {
        $role = CoreRole::where('role_name', 'sysadmin')->first() ?? $this->role('sysadmin');

        return $this->user($attributes, $role);
    }

    /**
     * @description Creates an account whose role grants exactly the given permissions.
     * @param string[] $permissionKeys Permission keys of the account's role.
     * @param array<string, mixed> $attributes Column overrides.
     * @return User
     */
    protected function userWith(array $permissionKeys, array $attributes = []): User
    {
        static $roleSequence = 0;
        $roleSequence++;

        return $this->user($attributes, $this->role("role-{$roleSequence}", $permissionKeys));
    }

    /**
     * @description Signs the given account in for the following requests (Sanctum guard).
     * @param User $user Account to act as.
     * @return User The same account.
     */
    protected function signIn(User $user): User
    {
        return Sanctum::actingAs($user, ['*']);
    }

    /**
     * @description Step-up: the signed-in account confirms its password for one operation scope
     *   (POST /api/confirm-password, App\Traits\RequiresPasswordConfirmation) - single use.
     * @param string $scope Operation scope, e.g. 'user:25', 'user:new', 'email-policy'.
     * @return void
     */
    protected function confirmPassword(string $scope): void
    {
        $this->postJson('/api/confirm-password', ['password' => $this->defaultPassword, 'scope' => $scope])->assertNoContent();
    }

    /**
     * @description Issues a real Sanctum access token and returns the Authorization header
     *   - for flows that need an actual token row (logout, token revocation).
     * @param User $user Token owner.
     * @return array<string, string> Request headers.
     */
    protected function bearer(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('access-token')->plainTextToken];
    }

    /**
     * @description Whether a security event of the given type was recorded.
     * @param string $eventType Event type, e.g. 'login_failed'.
     * @param string|null $severity Expected severity, null = any.
     * @return void
     */
    protected function assertSecurityEvent(string $eventType, ?string $severity = null): void
    {
        $query = CoreSecurityEvent::where('event_type', $eventType);
        if ($severity !== null) {
            $query->where('severity', $severity);
        }
        $this->assertTrue($query->exists(), "Security event '{$eventType}'" . ($severity ? " ({$severity})" : '') . ' was not recorded.');
    }

    /**
     * @description Whether an audit log row with the given event type exists in core_logs.
     * @param string $eventType Event type, e.g. 'login_success'.
     * @param string|null $descriptionContains Optional fragment of the description.
     * @return void
     */
    protected function assertCoreLog(string $eventType, ?string $descriptionContains = null): void
    {
        $query = CoreLog::where('event_type', $eventType);
        if ($descriptionContains !== null) {
            $query->where('description', 'like', '%' . $descriptionContains . '%');
        }
        $this->assertTrue($query->exists(), "core_logs entry '{$eventType}'" . ($descriptionContains ? " containing '{$descriptionContains}'" : '') . ' not found.');
    }
}
