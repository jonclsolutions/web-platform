<?php
/**
 * @file CreateSysadminCommand.php
 * @path app/Console/Commands/CreateSysadminCommand.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Creates the first system administrator of a new installation from the server
 *   console: `php artisan security:create-sysadmin [email]` asks for the e-mail, the name and the
 *   password (typed twice, never shown), validates them like the application does (e-mail
 *   rfc + strict, password 8–16 characters with a letter, a digit and a symbol), creates the
 *   activated account with the sysadmin role and adds the e-mail as an exception of the e-mail
 *   access policy, so the account can log in even after a company domain is set.
 *   `--if-none` does nothing when a sysadmin account exists already (configure-server.sh runs
 *   it on every deployment). Written to the core log, without the password.
 * @note Production never gets a default account with a known password - the local test account
 *   (DevelopmentSeeder) exists only in APP_ENV=local. 2FA by e-mail is forced for the sysadmin
 *   role, so the mail settings of .env must work before the first login.
 * @dependencies
 * - CoreRole `sysadmin` (BaseDataSeeder - run `php artisan db:seed` first), User,
 *   CoreEmailAccessRule, CoreLog.
 */

namespace App\Console\Commands;

use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreRole;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateSysadminCommand extends Command
{
    /** @var string */
    protected $signature = 'security:create-sysadmin
        {email? : E-mail of the account (asked when missing)}
        {--if-none : Do nothing when a sysadmin account exists already}';

    /** @var string */
    protected $description = 'Creates an activated system administrator account (password typed in the console).';

    /** Role name of the system administrator (same constant as everywhere in the app). */
    private const SYSADMIN_ROLE = 'sysadmin';

    /** Attempts for a valid password before the command gives up. */
    private const PASSWORD_ATTEMPTS = 3;

    /**
     * @description Asks, validates and creates the account.
     * @return int 0 = created / nothing to do; 1 = missing role, invalid input.
     */
    public function handle(): int
    {
        $role = CoreRole::where('role_name', self::SYSADMIN_ROLE)->first();
        if (!$role) {
            $this->error('The sysadmin role does not exist - run `php artisan db:seed --force` first.');
            return self::FAILURE;
        }
        if ($this->option('if-none') && $role->users()->exists()) {
            $this->info('A sysadmin account exists already - nothing to do.');
            return self::SUCCESS;
        }

        $email = strtolower(trim((string) ($this->argument('email') ?? $this->ask('E-mail of the sysadmin account'))));
        $emailCheck = Validator::make(['email' => $email], ['email' => ['required', 'email:rfc,strict', 'max:255', 'unique:users,user_email']]);
        if ($emailCheck->fails()) {
            $this->error($emailCheck->errors()->first('email'));
            return self::FAILURE;
        }

        $name = trim((string) $this->ask('Full name', 'System administrator'));
        $password = $this->askPassword();
        if ($password === null) {
            $this->error('No valid password entered - account not created.');
            return self::FAILURE;
        }

        $user = DB::transaction(function () use ($email, $name, $password, $role) {
            $user = User::create([
                'user_email'         => $email,
                'full_name'          => mb_substr($name !== '' ? $name : 'System administrator', 0, 255),
                'user_password_hash' => Hash::make($password),
                'activated_at'       => now(),
                'is_blocked'         => false,
            ]);
            $user->roles()->attach($role->id);

            if (!CoreEmailAccessRule::where('type', 'email')->where('value', $email)->exists()) {
                CoreEmailAccessRule::create(['type' => 'email', 'value' => $email]);
            }

            CoreLog::create([
                'origin'               => 'cli',
                'event_type'           => 'sysadmin_created',
                'module'               => 'Core',
                'description'          => "Sysadmin account created from the server console: {$email}",
                'affected_entity_type' => 'User',
                'affected_entity_id'   => $user->id,
                'user_id'              => null,
                'context_data'         => ['command' => 'security:create-sysadmin'],
                'user_id_plain'        => '0',
                'user_plain'           => 'system',
            ]);

            return $user;
        });

        $this->info("Sysadmin {$user->user_email} created and activated. The first login asks for a 2FA code sent by e-mail.");
        return self::SUCCESS;
    }

    /**
     * @description Asks for the password twice (hidden input) until it is valid and confirmed.
     * @return string|null The password, or null after PASSWORD_ATTEMPTS failed attempts.
     */
    private function askPassword(): ?string
    {
        for ($attempt = 1; $attempt <= self::PASSWORD_ATTEMPTS; $attempt++) {
            $password = (string) $this->secret('Password (8–16 characters, a letter, a digit and a symbol)');
            $check = Validator::make(['password' => $password], [
                'password' => ['required', 'string', 'max:16', Password::min(8)->letters()->numbers()->symbols()],
            ]);
            if ($check->fails()) {
                $this->warn($check->errors()->first('password'));
                continue;
            }
            if ((string) $this->secret('Password again') !== $password) {
                $this->warn('The passwords do not match.');
                continue;
            }
            return $password;
        }
        return null;
    }
}
