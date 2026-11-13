<?php
/**
 * @file 2026_11_19_000000_web_project_account_notifications.php
 * @path api/app/Apps/ProjectPortal/Database/Migrations/2026_11_19_000000_web_project_account_notifications.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The e-mail notifications of a client account are chosen by the client in the
 *   portal (section "My account"), separately per kind - a new reply of the supplier, a change of
 *   a checkpoint status, a new / changed checkpoint due date. All are off by default. The former
 *   single switch `notify_email` (set by the administration) becomes all three kinds.
 * @dependencies web_project_accounts (2026_11_18_000000_web_project_portal_accounts)
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @description Adds the three switches, carries the former one over and drops it.
     * @return void
     */
    public function up(): void
    {
        Schema::table('web_project_accounts', function (Blueprint $table) {
            $table->boolean('notify_replies')->default(false)->after('email');
            $table->boolean('notify_checkpoint_status')->default(false)->after('notify_replies');
            $table->boolean('notify_checkpoint_dates')->default(false)->after('notify_checkpoint_status');
        });

        DB::table('web_project_accounts')->where('notify_email', true)->update([
            'notify_replies'           => true,
            'notify_checkpoint_status' => true,
            'notify_checkpoint_dates'  => true,
        ]);

        Schema::table('web_project_accounts', function (Blueprint $table) {
            $table->dropColumn('notify_email');
        });
    }

    /**
     * @description Reverts to the single switch (on when any kind was on).
     * @return void
     */
    public function down(): void
    {
        Schema::table('web_project_accounts', function (Blueprint $table) {
            $table->boolean('notify_email')->default(false)->after('email');
        });

        DB::table('web_project_accounts')
            ->where(fn ($q) => $q->where('notify_replies', true)->orWhere('notify_checkpoint_status', true)->orWhere('notify_checkpoint_dates', true))
            ->update(['notify_email' => true]);

        Schema::table('web_project_accounts', function (Blueprint $table) {
            $table->dropColumn(['notify_replies', 'notify_checkpoint_status', 'notify_checkpoint_dates']);
        });
    }
};
