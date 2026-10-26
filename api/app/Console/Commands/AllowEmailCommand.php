<?php
/**
 * @file AllowEmailCommand.php
 * @path app/Console/Commands/AllowEmailCommand.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-24
 * @description Emergency access for the e-mail access policy. Since 2026-10-24 the policy
 *   applies to every role, sysadmin included (AuthController). The policy editor refuses a
 *   change that locks out the ACTING sysadmin, but a policy edited directly in the database
 *   (or a sysadmin whose e-mail changed) can still leave nobody able to log in. Whoever has
 *   shell access to the server can then allow one e-mail again:
 *   `php artisan security:email-policy-allow admin@example.com`
 *   It adds an e-mail exception (the same as "Add exception → E-mail" in the admin) and writes
 *   it to the core log. It changes nothing else (no password, no role).
 * @dependencies
 * - CoreEmailAccessRule (normalizes the value on save), CoreLog.
 */

namespace App\Console\Commands;

use App\Models\Core\CoreEmailAccessRule;
use App\Models\Core\CoreLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class AllowEmailCommand extends Command
{
    /** @var string */
    protected $signature = 'security:email-policy-allow {email : E-mail to allow as an exception}';

    /** @var string */
    protected $description = 'Adds an e-mail exception to the e-mail access policy (emergency access when nobody can log in).';

    /**
     * @description Validates the e-mail and adds the exception (idempotent).
     * @return int 0 = allowed (added or already there), 1 = invalid e-mail.
     */
    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));

        if (Validator::make(['email' => $email], ['email' => 'required|email|max:255'])->fails()) {
            $this->error("Not a valid e-mail: {$email}");
            return self::FAILURE;
        }

        if (CoreEmailAccessRule::where('type', 'email')->where('value', $email)->exists()) {
            $this->info("{$email} is already allowed (e-mail exception exists).");
            return self::SUCCESS;
        }

        $rule = CoreEmailAccessRule::create(['type' => 'email', 'value' => $email]);

        CoreLog::create([
            'origin'               => 'cli',
            'event_type'           => 'email_access_rule_created',
            'module'               => 'Core',
            'description'          => "Added whitelist item (email) from the server console: {$email}",
            'affected_entity_type' => 'CoreEmailAccessRule',
            'affected_entity_id'   => $rule->id,
            'user_id'              => null,
            'context_data'         => ['command' => 'security:email-policy-allow'],
            'user_id_plain'        => '0',
            'user_plain'           => 'system',
        ]);

        $this->info("{$email} is allowed now (e-mail exception added).");
        return self::SUCCESS;
    }
}
