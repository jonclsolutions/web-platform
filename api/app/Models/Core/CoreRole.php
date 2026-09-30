<?php
/**
 * @file CoreRole.php
 * @path app/Models/Core/CoreRole.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing user roles within the system.
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail", bod 3: přidán sloupec
 * `forces_2fa` - umožňuje sysadminovi vynutit 2FA HROMADNĚ pro celou (custom) roli,
 * místo nutnosti klikat uživatele jednoho po druhém. Netýká se `sysadmin`/`admin` -
 * ty mají 2FA vynuceno natvrdo v `User::FORCED_2FA_ROLE_NAMES`, nezávisle na datech
 * (viz User::requiresTwoFactor()), a `isProtected()` navíc blokuje jakoukoliv úpravu
 * těchto rolí přes CoreRoleController, takže `forces_2fa` u nich není ani editovatelné.
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @description Defines roles that determine user access levels and permissions.
 *
 * @property int $id The unique identifier for the role.
 * @property string $role_name The display name of the role.
 * @property string|null $description Optional details about the role's purpose.
 * @property bool $forces_2fa Whether all users with this role must use 2FA.
 */
class CoreRole extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'role_name',
        'description',
        'forces_2fa',
    ];

    protected $casts = [
        'forces_2fa' => 'boolean',
    ];

    /**
     * Systémové role, které nelze editovat ani smazat přes UI/API správy rolí.
     * @note (2026) `primeadmin` byla dříve v tomhle seznamu jako "záložní klíč" bez
     *       vlastního self-service resetu hesla. Teď, když existuje reset hesla přes
     *       e-mail, se primeadmin chová jako naprosto běžná (needitovatelná ochrana
     *       se na ni nevztahuje) role - lze ji editovat i smazat stejně jako custom role.
     *       Jediné trvale chráněné role jsou `sysadmin` a `admin`.
     *
     * @var array<int, string>
     */
    public const PROTECTED_ROLE_NAMES = ['sysadmin'];

    /**
     * @description Určuje, zda je role systémová (chráněná před editací/smazáním).
     * @return bool
     */
    public function isProtected(): bool
    {
        return in_array(strtolower($this->role_name), self::PROTECTED_ROLE_NAMES, true);
    }

    /**
     * Get the users assigned to this role.
     * @return BelongsToMany
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_roles', 'role_id', 'user_id');
    }

    /**
     * Get the permissions associated with this role.
     * @return BelongsToMany
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(
            CorePermission::class,
            'core_role_permissions',
            'role_id',
            'permission_id'
        );
    }
}