<?php
/**
 * @file PruneAuthDataCommand.php
 * @path app/Console/Commands/PruneAuthDataCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Daily clean-up of the short-lived authentication rows that are deleted only per
 * user otherwise (on the next login / request of the same user) - without it they pile up for
 * users who never come back: expired or used 2FA codes (with the IP address of the login),
 * password reset and account activation tokens, expired refresh tokens and expired rows of the
 * database cache. Expired Sanctum access tokens are removed by `sanctum:prune-expired` (see
 * routes/console.php).
 * @note A row is removed one day after it expired or was used - the margin keeps the rows of
 * a login in progress and never touches a valid token.
 */

namespace App\Console\Commands;

use App\Models\AccountActivationToken;
use App\Models\PasswordResetToken;
use App\Models\RefreshToken;
use App\Models\TwoFactorCode;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class PruneAuthDataCommand extends Command
{
    /**
     * @description Name and signature of the Artisan command.
     * @var string
     */
    protected $signature = 'auth:prune';

    /**
     * @description Short description shown by `php artisan list`.
     * @var string
     */
    protected $description = 'Deletes expired / used 2FA codes, reset and activation tokens, refresh tokens and expired cache rows.';

    /**
     * @description Deletes the rows and prints the counts (also written to the application log).
     * @return int Exit code (0 = success).
     */
    public function handle(): int
    {
        $cutoff = Carbon::now()->subDay();

        $counts = [
            'two_factor_codes'          => TwoFactorCode::where('expires_at', '<', $cutoff)->orWhere('used_at', '<', $cutoff)->delete(),
            'password_reset_tokens'     => PasswordResetToken::where('expires_at', '<', $cutoff)->orWhere('used_at', '<', $cutoff)->delete(),
            'account_activation_tokens' => AccountActivationToken::where('expires_at', '<', $cutoff)->delete(),
            'refresh_tokens'            => RefreshToken::where('expires_at', '<', $cutoff)->delete(),
            'cache'                     => $this->pruneDatabaseCache(),
        ];

        foreach ($counts as $table => $count) {
            $this->line(sprintf('%-26s %d', $table, $count));
        }
        Log::info('Authentication data pruned', $counts);

        return self::SUCCESS;
    }

    /**
     * @description Expired rows of the database cache store (the store deletes an expired row
     * only when the same key is read again).
     * @return int Deleted rows (0 for another cache store).
     */
    private function pruneDatabaseCache(): int
    {
        if (config('cache.default') !== 'database') {
            return 0;
        }
        $table = config('cache.stores.database.table', 'cache');

        return Schema::hasTable($table) ? DB::table($table)->where('expiration', '<', Carbon::now()->getTimestamp())->delete() : 0;
    }
}
