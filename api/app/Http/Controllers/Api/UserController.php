<?php
/**
 * @file UserController.php
 * @path app/Http/Controllers/Api/UserController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user account lifecycles, including creation, role assignment, password security policies, and administrative audit logging.
 * @note (2026) Jediné trvale chráněné role jsou 'sysadmin' a 'admin'.
 *
 * @refactor-note (2026-08-3) KRITICKÁ BEZPEČNOSTNÍ OCHRANA "jen sysadmin smí zasáhnout
 * sysadmina" je aplikovaná na store(), update(), changePassword(), destroy() a
 * forceDeleteAllTrashed().
 *
 * @refactor-note (2026-08-4) changePassword() odesílá PasswordChangedNotification PŘI
 * KAŽDÉ změně hesla, s per-cílový-účet rate limitem proti zahlcení příjemce.
 *
 * @refactor-note (2026-08-12) `id` z route validováno přes ctype_digit() před použitím.
 *
 * @refactor-note (2026-08-7) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait.
 *
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail", body 2+3+4 sloučeny do
 * update(): (a) `resolveEnable2fa()` už NEPŘEPISUJE tiše požadavek na vypnutí 2FA u
 * vynucené role/účtu - pokud je cíl vynucený (role admin/sysadmin, role s
 * `forces_2fa=true`, nebo `two_fa_forced_by_admin=true`) a request explicitně žádá
 * `enable_2fa: false`, vrací se 422 (frontend to zobrazí jako červenou notifikaci
 * namísto tichého ignorování). (b) `two_fa_forced_by_admin` (sysadmin override na
 * konkrétním účtu) se teď nastavuje TAKÉ přes tento endpoint (dřív samostatný
 * TwoFactorAdminController - SLOUČENO na žádost, jeden formulář/jeden request) - smí ho
 * měnit VÝHRADNĚ sysadmin (actorIsSysadmin()), a NELZE ho nastavit na cíl, který má 2FA
 * vynucené už rolí (admin/sysadmin/forces_2fa role) - takový override by byl nesmyslný
 * (2FA je vynuceno tak jako tak) a matoucí v UI, proto 422. `TwoFactorAdminController`
 * lze smazat, jeho routa `PUT core/users/{id}/two-factor-requirement` z api.php odstraněna.
 *
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu":
 * - `store()` už NEPŘIJÍMÁ heslo (viz StoreUserRequest - `user_password_hash` z
 *   validace úplně odstraněno). Účet se vytváří s `user_password_hash = null`,
 *   `is_blocked = false`, `activated_at = null`. Ihned po commitu (aby selhání mailu
 *   nikdy nerollbacklo už založený účet) se pošle aktivační e-mail s odkazem na
 *   nastavení hesla - viz `sendActivationEmail()`/`AccountActivationController`.
 * - Nová metoda `resendActivation()` - umožňuje adminovi znovu odeslat aktivační odkaz
 *   (nový token, starý zaniká) u účtu, který se ještě nikdy neaktivoval. Route chráněná
 *   `core-administrators-update` (viz api.php).
 * - `update()` dostal kontrolu blokace: `is_blocked` NELZE nastavit na `true` (a) na
 *   vlastní účet, (b) na účet s rolí admin/sysadmin - ABSOLUTNÍ zákaz, i pro sysadmina
 *   (rozhodnuto v backlogu: "nesmí zablokovat v žádném případě"). Přechod
 *   false -> true navíc OKAMŽITĚ revokuje všechny aktivní Sanctum tokeny i refresh
 *   token daného účtu - zablokovaný účet tak nemůže dál používat systém, dokud mu
 *   access token sám nevyprší.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\Auth\AccountActivationMail;
use App\Mail\Auth\PasswordChangedNotification;
use App\Models\{AccountActivationToken, RefreshToken, User};
use App\Models\Core\CoreRole;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use App\Http\Requests\User\{StoreUserRequest, UpdateUserRequest};
use App\Http\Requests\PasswordChangeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\{Request, JsonResponse};
use Illuminate\Support\Facades\{Hash, Log, DB, Mail, RateLimiter};

class UserController extends Controller
{
    use LogsActivity;

    private const SYSADMIN_ROLE_NAME = 'sysadmin';
    private const PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS = 5;
    private const PASSWORD_CHANGE_NOTIFY_DECAY_SECONDS = 3600;

    /**
     * @description Role, jejichž účty NELZE NIKDY zablokovat - absolutní zákaz, platí
     * i pro sysadmina samotného (rozhodnuto v backlogu). Stejný seznam jako
     * `User::FORCED_2FA_ROLE_NAMES` - obě ochrany se týkají stejných "trvale
     * chráněných" rolí, ale jsou to nezávislé kontroly (2FA vynucení vs. blokace).
     */
    private const NEVER_BLOCK_ROLE_NAMES = ['admin', 'sysadmin'];

    /**
     * Retrieves a paginated list of users with filtering and role-based sorting.
     */
/**
     * @bugfix-note (2026-08-25) BACKLOG "hledat napříč vším": přidán globální `search`
     * parametr (OR napříč `full_name`/`user_email`) - stejné dva textové sloupce, které
     * tahle metoda už dřív filtrovala jednotlivě. `search` je zabalený do vlastního
     * `where(function ($q) { ... })` bloku - viz CoreExternalLinkController pro
     * podrobné vysvětlení, proč holý `orWhere()` na hlavní `$query` builder je
     * nebezpečný (rozbil by AND spojení s předchozími podmínkami, konkrétně tady by to
     * ovlivnilo `onlyTrashed()`/`withoutTrashed()` scoping z Eloquent SoftDeletes -
     * bez obalení by `search` mohl vrátit i smazané/nesmazané záznamy mimo aktuálně
     * zvolený pohled).
     *
     * @note Search NEPOKRÝVÁ `role_name` (přiřazenou roli) - to by vyžadovalo vždy
     * aktivní JOIN na `user_roles`/`roles`, zatímco dnes se joinuje jen podmíněně (při
     * řazení podle role_name, viz blok níže). Pokud bude v budoucnu potřeba hledat i
     * podle role, je to samostatné rozšíření (trvalý LEFT JOIN), ne triviální přidání
     * do stávajícího search bloku.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $onlyTrashed = filter_var($request->input('only_trashed', false), FILTER_VALIDATE_BOOLEAN)
                    || filter_var($request->input('is_deleted', false), FILTER_VALIDATE_BOOLEAN);

        $sortBy = $request->input('sort_by', 'id');
        $dir = in_array(strtolower($request->input('sort_direction')), ['asc', 'desc']) ? $request->input('sort_direction') : 'desc';

        $query = User::query()->withTrashed();

        $onlyTrashed ? $query->onlyTrashed() : $query->withoutTrashed();

        if ($request->filled('full_name')) $query->where('full_name', 'like', "%{$request->full_name}%");
        if ($request->filled('user_email')) $query->where('user_email', 'like', "%{$request->user_email}%");

        // Globální fulltextový search napříč full_name/user_email - viz bugfix-note výše.
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('user_email', 'like', "%{$search}%");
            });
        }

        if ($sortBy === 'role_name') {
            $query->select('users.*')
                ->leftJoin('user_roles as ur', 'users.id', '=', 'ur.user_id')
                ->leftJoin('roles as r', 'ur.role_id', '=', 'r.id')
                ->orderBy('r.role_name', $dir);
        } else {
            $sortColumn = str_contains($sortBy, '.') ? $sortBy : "users.$sortBy";
            $query->orderBy($sortColumn, $dir);
        }

        $noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

        if ($noPagination) {
            $this->logAction($request, CoreLog::class, 'export', 'User', "Hromadný export uživatelů.");
            $users = $query->with('roles.permissions')->get();
            return response()->json(UserResource::collection($users));
        }

        $users = $query->with('roles.permissions')->paginate($perPage);

        return response()->json([
            'data' => UserResource::collection($users->items()),
            'total' => $users->total(),
            'per_page' => $users->perPage(),
            'current_page' => $users->currentPage(),
            'last_page' => $users->lastPage(),
        ]);
    }
    /**
     * Creates a new user WITHOUT a password and sends an activation e-mail so the user
     * can set their own password (no one, not even the admin, ever knows it).
     * @note KRITICKÁ OCHRANA: vytvořit nový účet s rolí sysadmin smí jen volající, který
     * je sám sysadmin.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $roleId = $validated['role_id'] ?? null;

        if ($roleId && $this->isSysadminRoleId((int) $roleId) && !$this->actorIsSysadmin($request)) {
            $this->logAction($request, CoreLog::class, 'create_denied', 'User', "Zamítnut pokus o vytvoření nového sysadmin účtu: {$validated['user_email']}");
            return response()->json(['message' => 'Nový účet s rolí sysadmin smí vytvořit pouze jiný sysadmin.'], 403);
        }

        DB::beginTransaction();
        try {
            $forced = $this->isRoleForced2fa($roleId);
            $validated['enable_2fa'] = $forced ? true : ($validated['enable_2fa'] ?? false);
            // two_fa_forced_by_admin nelze nastavit při vytváření (nový účet nemá historii) -
            // sysadmin ho případně nastaví následným update().
            unset($validated['two_fa_forced_by_admin']);

            // Účet vzniká BEZ hesla - nastaví si ho sám uživatel přes aktivační odkaz
            // (viz AccountActivationController::activate()). Dokud tak neučiní, login
            // je zablokovaný na úrovni AuthController::login() (user_password_hash IS NULL).
            $validated['user_password_hash'] = null;
            $validated['is_blocked'] = false;
            $validated['activated_at'] = null;

            $user = User::create($validated);

            if ($roleId) {
                $user->roles()->attach($roleId);
            }

            DB::commit();

            // Mail se posílá AŽ PO commitu - selhání odeslání (SMTP výpadek apod.)
            // nesmí rollbacknout už vytvořený účet. Admin má řádkovou akci "Aktivace"
            // (resendActivation()) pro případ, že se e-mail ztratí, vyprší, nebo se
            // nepodaří odeslat hned teď - viz $emailSent níže, které frontend zobrazí
            // jako varování místo tichého "úspěchu".
            $emailSent = $this->sendActivationEmail($user);

            $this->logAction(
                $request,
                CoreLog::class,
                'create',
                'User',
                "Vytvořen uživatel (čeká na aktivaci): {$user->user_email}" . (!$emailSent ? ' [AKTIVAČNÍ E-MAIL SE NEPODAŘILO ODESLAT]' : ''),
                $user->id,
                'User'
            );

            $response = new UserResource($user->load('roles.permissions'));
            return response()->json($response->additional(['activation_email_sent' => $emailSent]), 201);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při vytváření uživatele: " . $e->getMessage());
            return response()->json(['message' => 'Chyba při vytváření uživatele.'], 500);
        }
    }

    /**
     * Displays details for a specific user.
     */
    public function show(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        $user = User::withTrashed()->findOrFail($id);

        return response()->json(new UserResource($user->load('roles.permissions')));
    }

    /**
     * Updates an existing user's information.
     * @note KRITICKÁ OCHRANA: pokud je cílový účet sysadmin, NEBO request žádá o
     * povýšení cílového účtu na sysadmina, smí to provést jen volající, který je SÁM
     * sysadmin. `enable_2fa` nelze u vynucených účtů/rolí explicitně vypnout (422).
     * `two_fa_forced_by_admin` smí měnit jen sysadmin a jen na účtech, které NEMAJÍ 2FA
     * vynucené jinak (rolí) - jinak by byl override bezpředmětný (422). `is_blocked`
     * nelze NIKDY nastavit na účet admin/sysadmin ani na vlastní účet (422) - viz
     * refactor-note v hlavičce souboru. Přechod na `is_blocked = true` revokuje tokeny.
     */
    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        $user = User::findOrFail($id);
        $validated = $request->validated();

        $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
        $promotingToSysadmin = isset($validated['role_id']) && !$targetIsSysadmin
            && $this->isSysadminRoleId((int) $validated['role_id']);

        if (($targetIsSysadmin || $promotingToSysadmin) && !$this->actorIsSysadmin($request)) {
            $reason = $targetIsSysadmin
                ? "Zamítnuta úprava sysadmin účtu: {$user->user_email}"
                : "Zamítnut pokus o povýšení účtu na sysadmina: {$user->user_email}";
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', $reason, (int) $id, 'User');
            return response()->json(['message' => 'Účet s rolí sysadmin smí upravovat, nebo na ni povyšovat, pouze jiný sysadmin.'], 403);
        }

        // ── 2FA vynucení (role) - viz refactor-note v hlavičce souboru ─────────────────
        $effectiveRoleId = $validated['role_id'] ?? $user->roles()->first()?->id;
        $forcedByRole = $this->isRoleForced2fa($effectiveRoleId);

        // Efektivní vynucení = rolí NEBO existující sysadmin override (pokud request
        // two_fa_forced_by_admin nemění, bere se stávající hodnota z DB).
        $effectiveAdminForced = array_key_exists('two_fa_forced_by_admin', $validated)
            ? (bool) $validated['two_fa_forced_by_admin']
            : (bool) $user->two_fa_forced_by_admin;

        $isForced = $forcedByRole || $effectiveAdminForced;

        if ($isForced && array_key_exists('enable_2fa', $validated) && !$validated['enable_2fa']) {
            $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Zamítnut pokus o vypnutí 2FA u vynuceného účtu: {$user->user_email}", (int) $id, 'User');
            return response()->json(['message' => 'Dvoufaktorové ověření nelze u tohoto účtu vypnout - je vynuceno.'], 422);
        }

        $validated['enable_2fa'] = $isForced ? true : ($validated['enable_2fa'] ?? $user->enable_2fa);

        // ── two_fa_forced_by_admin (sysadmin override) - viz refactor-note v hlavičce ──
        if (array_key_exists('two_fa_forced_by_admin', $validated)) {
            if (!$this->actorIsSysadmin($request)) {
                $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Zamítnut pokus o změnu vynucení 2FA (není sysadmin): {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Vynucení 2FA smí měnit pouze sysadmin.'], 403);
            }

            if ($forcedByRole) {
                return response()->json(['message' => '2FA je pro tuto roli vynuceno automaticky - ruční vynucení není potřeba ani možné.'], 422);
            }
        } else {
            // Pole nebylo v requestu vůbec - nechat stávající hodnotu beze změny.
            unset($validated['two_fa_forced_by_admin']);
        }

        // ── is_blocked (blokace účtu) - ABSOLUTNÍ ochrana admin/sysadmin ───────────────
        // Kontrola PŘED update() - potřebujeme rozhodnout ještě než se cokoliv zapíše.
        if (array_key_exists('is_blocked', $validated) && $validated['is_blocked']) {
            if ((int) $request->user()->id === (int) $user->id) {
                return response()->json(['message' => 'Nelze zablokovat vlastní účet.'], 422);
            }

            // Efektivní role po případné změně v tomto requestu (stejná logika jako
            // $effectiveRoleId výše, ale explicitně přes jméno role kvůli čitelnosti).
            $effectiveRoleName = $effectiveRoleId ? CoreRole::find($effectiveRoleId)?->role_name : null;
            $currentRoleNames = $user->roles()->pluck('role_name');

            $isProtectedRole = in_array($effectiveRoleName, self::NEVER_BLOCK_ROLE_NAMES, true)
                || $currentRoleNames->intersect(self::NEVER_BLOCK_ROLE_NAMES)->isNotEmpty();

            if ($isProtectedRole) {
                $this->logAction($request, CoreLog::class, 'update_denied', 'User', "Zamítnut pokus o zablokování chráněného účtu: {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Účty s rolí admin/sysadmin nelze nikdy zablokovat.'], 422);
            }
        }

        $wasBlocked = (bool) $user->is_blocked;

        if (!empty($validated['user_password_hash'])) {
            $validated['user_password_hash'] = Hash::make($validated['user_password_hash']);
        } else {
            unset($validated['user_password_hash']);
        }

        DB::beginTransaction();
        try {
            $user->update($validated);

            if (isset($validated['role_id'])) {
                if ($request->user()->id !== $user->id) {
                    $user->roles()->sync([$validated['role_id']]);
                }
            }

            // Přechod false -> true: OKAMŽITĚ zneplatnit veškerý aktivní přístup, jinak
            // by kompromitovaný účet mohl dál používat systém, dokud mu access token
            // sám nevyprší (viz backlog rozhodnutí o smyslu blokace).
            if (!$wasBlocked && $user->is_blocked) {
                $user->tokens()->delete();
                RefreshToken::where('user_id', $user->id)->delete();
                $this->logAction($request, CoreLog::class, 'account_blocked', 'User', "Účet zablokován, aktivní tokeny zneplatněny: {$user->user_email}", $user->id, 'User');
            }

            DB::commit();
            $this->logAction($request, CoreLog::class, 'update', 'User', "Aktualizace uživatele: {$user->user_email}", $user->id, 'User');
            return response()->json(new UserResource($user->load('roles.permissions')));

        } catch (\Exception $e) {
            DB::rollBack();
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při updatu uživatele ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Chyba serveru při ukládání.'], 500);
        }
    }

    /**
     * Handles password changes with administrative validation requirements.
     * @note KRITICKÁ OCHRANA: cizí sysadmin účet smí heslo změnit jen jiný sysadmin.
     * Po úspěšné změně se VŽDY odešle PasswordChangedNotification s rate limitem.
     */
    public function changePassword(PasswordChangeRequest $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        try {
            $user = User::findOrFail($id);
            $validated = $request->validated();
            $auth = $request->user() ?? auth('sanctum')->user();

            $isOwner = $user->id === $auth->id;

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
            if ($targetIsSysadmin && !$isOwner) {
                $actorIsSysadmin = $auth->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();
                if (!$actorIsSysadmin) {
                    $this->logAction($request, CoreLog::class, 'password_change_denied', 'User', "Zamítnut pokus o změnu hesla sysadmin účtu: {$user->user_email}", (int) $id, 'User');
                    return response()->json(['message' => 'Heslo účtu s rolí sysadmin smí změnit pouze jiný sysadmin.'], 403);
                }
            }

            $isAdmin = $auth->roles()->whereIn('role_name', ['admin', 'sysadmin'])->exists();

            if (!$isOwner && !$isAdmin) {
                return response()->json(['message' => 'Nedostatečná oprávnění.'], 403);
            }

            if (!isset($validated['old_password']) || !Hash::check($validated['old_password'], $auth->user_password_hash)) {
                return response()->json(['message' => 'Vaše potvrzovací heslo (aktuální heslo) je nesprávné.'], 403);
            }

            $user->update(['user_password_hash' => Hash::make($validated['new_password'])]);

            $this->logAction(
                $request,
                CoreLog::class,
                'PasswordChanged',
                'User',
                "Změna hesla u: {$user->user_email} " . ($isAdmin && !$isOwner ? "(provedl admin: {$auth->user_email})" : ""),
                $user->id,
                'User'
            );

            $this->notifyPasswordChanged($request, $user);

            return response()->json(['message' => 'Heslo úspěšně změněno.']);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při změně hesla ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Změna hesla selhala.'], 500);
        }
    }

    /**
     * Restores a soft-deleted user.
     */
    public function restore(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        try {
            $user = User::withTrashed()->findOrFail($id);
            $user->restore();

            $this->logAction(request(), CoreLog::class, 'restore', 'User', "Obnoven uživatel: {$user->user_email}", $user->id, 'User');
            return response()->json(new UserResource($user->load('roles.permissions')));
        } catch (\Exception $e) {
            $this->logAction(request(), CoreLog::class, 'error', 'User', "Chyba při obnově uživatele ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Obnova uživatele selhala.'], 500);
        }
    }

    /**
     * Handles soft or hard deletion of a user.
     * @note Uživatel nemůže smazat sám sebe. KRITICKÁ OCHRANA: účet s rolí 'sysadmin'
     * smí smazat výhradně jiný sysadmin.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        try {
            $user = User::withTrashed()->findOrFail($id);

            if ($request->user()?->id == $id) {
                return response()->json(['message' => 'Nelze smazat vlastní účet.'], 403);
            }

            $targetIsSysadmin = $user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists();

            if ($targetIsSysadmin && !$this->actorIsSysadmin($request)) {
                $this->logAction($request, CoreLog::class, 'delete_denied', 'User', "Zamítnut pokus o smazání sysadmin účtu: {$user->user_email}", (int) $id, 'User');
                return response()->json(['message' => 'Účet s rolí sysadmin smí smazat pouze jiný sysadmin.'], 403);
            }

            $force = filter_var($request->input('force_delete', false), FILTER_VALIDATE_BOOLEAN);
            $force ? $user->forceDelete() : $user->delete();

            $this->logAction($request, CoreLog::class, $force ? 'hard_delete' : 'soft_delete', 'User', "Smazáno ID: $id", (int) $id, 'User');
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction($request, CoreLog::class, 'error', 'User', "Chyba při mazání uživatele ID {$id}: " . $e->getMessage(), (int) $id, 'User');
            return response()->json(['message' => 'Smazání uživatele selhalo.'], 500);
        }
    }

    /**
     * Permanently deletes all soft-deleted users.
     * @note KRITICKÁ OCHRANA: trashnuté účty s rolí 'sysadmin' se z hromadného
     * vyprázdnění koše vyjímají, pokud sám volající není sysadmin.
     */
    public function forceDeleteAllTrashed(): JsonResponse
    {
        try {
            $query = User::onlyTrashed();

            if (!$this->actorIsSysadmin(request())) {
                $query->whereDoesntHave('roles', function ($q) {
                    $q->where('role_name', self::SYSADMIN_ROLE_NAME);
                });
            }

            $count = $query->count();
            $query->forceDelete();

            $this->logAction(request(), CoreLog::class, 'force_delete_all', 'User', "Vysypání koše. Smazáno: $count");
            return response()->json(null, 204);
        } catch (\Exception $e) {
            $this->logAction(request(), CoreLog::class, 'error', 'User', "Chyba při vysypávání koše uživatelů: " . $e->getMessage());
            return response()->json(['message' => 'Vysypání koše selhalo.'], 500);
        }
    }

    /**
     * @description Znovu odešle aktivační e-mail (nový token, starý přestane platit) -
     * jen pro účty, které se ještě nikdy neaktivovaly. Účet, který už má nastavené
     * heslo (`activated_at` vyplněno), by tímto šlo obejít - proto je to zablokováno.
     */
    public function resendActivation(Request $request, string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return response()->json(['message' => 'Neplatné ID uživatele.'], 422);
        }

        $user = User::findOrFail($id);

        if ($user->activated_at) {
            return response()->json(['message' => 'Účet je již aktivovaný.'], 422);
        }

        $emailSent = $this->sendActivationEmail($user);

        if (!$emailSent) {
            $this->logAction($request, CoreLog::class, 'resend_activation_failed', 'User', "Opětovné odeslání aktivačního e-mailu selhalo: {$user->user_email}", $user->id, 'User');
            return response()->json(['message' => 'Odeslání e-mailu se nezdařilo. Zkontrolujte konfiguraci pošty a zkuste to znovu.'], 500);
        }

        $this->logAction($request, CoreLog::class, 'resend_activation', 'User', "Aktivační e-mail odeslán znovu: {$user->user_email}", $user->id, 'User');

        return response()->json(['message' => 'Aktivační e-mail byl odeslán znovu.']);
    }

    /**
     * @description Vygeneruje nový aktivační token a pošle e-mail. Chyba odeslání se
     * NIKDY nesmí shodit request, který uživatele vytváří/opakovaně aktivuje (proto
     * try/catch), ale volající (store()/resendActivation()) dostane návratovou hodnotu
     * a promítne ji do odpovědi - žádné tiché selhání, admin uvidí varování v UI a může
     * použít řádkovou akci "Aktivace" (viditelnou jen u neaktivovaných účtů).
     */
    private function sendActivationEmail(User $user): bool
    {
        $rawToken = AccountActivationToken::issueFor($user);
        try {
            Mail::to($user->user_email)->send(new AccountActivationMail($user, $rawToken));
            return true;
        } catch (\Throwable $e) {
            Log::error("Activation email failed for user {$user->id}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * @description Odešle PasswordChangedNotification na účet, kterému se heslo právě
     * změnilo, chráněné per-cílový-účet rate limiterem proti zahlcení příjemce.
     */
    private function notifyPasswordChanged(Request $request, User $user): void
    {
        $notifyKey = 'password-change-notify:' . $user->id;

        if (RateLimiter::tooManyAttempts($notifyKey, self::PASSWORD_CHANGE_NOTIFY_MAX_ATTEMPTS)) {
            $this->logAction($request, CoreLog::class, 'password_notification_rate_limited', 'User', "Notifikace o změně hesla potlačena (limit) pro: {$user->user_email}", $user->id, 'User');
            return;
        }

        RateLimiter::hit($notifyKey, self::PASSWORD_CHANGE_NOTIFY_DECAY_SECONDS);

        try {
            Mail::to($user->user_email)->send(
                new PasswordChangedNotification($user, now()->format('d.m.Y H:i'))
            );
        } catch (\Throwable $e) {
            Log::error("Password changed notification failed for user {$user->id}: " . $e->getMessage());
        }
    }

    /**
     * @description Zjišťuje, jestli přihlášený uživatel z daného requestu má roli
     * sysadmin.
     */
    private function actorIsSysadmin(Request $request): bool
    {
        return $request->user()
            ?->roles()
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists() ?? false;
    }

    /**
     * @description Zjišťuje, jestli daná role odpovídá roli sysadmin.
     */
    private function isSysadminRoleId(int $roleId): bool
    {
        return CoreRole::where('id', $roleId)
            ->where('role_name', self::SYSADMIN_ROLE_NAME)
            ->exists();
    }

    /**
     * @description Zjišťuje, jestli daná role vynucuje 2FA - buď protože je to
     * admin/sysadmin (hardcoded, viz User::FORCED_2FA_ROLE_NAMES), nebo protože sysadmin
     * nastavil `forces_2fa=true` na custom roli (viz CoreRole - bod 3 backlogu).
     */
    private function isRoleForced2fa(?int $roleId): bool
    {
        if (!$roleId) {
            return false;
        }

        $role = CoreRole::find($roleId);
        if (!$role) {
            return false;
        }

        return in_array($role->role_name, User::FORCED_2FA_ROLE_NAMES, true) || (bool) $role->forces_2fa;
    }
}