<?php
/**
 * @file 2026_11_18_000000_web_project_portal_accounts.php
 * @path api/database/migrations/2026_11_18_000000_web_project_portal_accounts.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Client project portal, phase 1:
 *   - `web_project_accounts`: several client accounts per project (login name + password set by
 *     the administration, optional e-mail with opt-in notifications). The former shared password
 *     of every project becomes its account "klient" (same password hash), so existing clients only
 *     need the login name. Portal sessions belong to an account; the old sessions are ended.
 *   - `web_projects.assignee_id`: the administrator responsible for the project (notifications
 *     about client activity go to them); the shared password columns are dropped.
 *   - `web_project_threads.last_public_author`: who wrote the last message the client can see
 *     ("waiting on us / on the client").
 *   - `web_project_thread_messages`: author account / user and internal notes (`is_internal`,
 *     never shown to the client).
 *   - `web_project_checkpoints`: due date and an internal note.
 * @dependencies web_projects, web_project_sessions, web_project_threads, web_project_thread_messages,
 *   web_project_checkpoints, users
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Login name of the account created from the former shared project password. */
    private const LEGACY_USERNAME = 'klient';

    /**
     * @description Creates the accounts, converts the shared passwords and adds the new columns.
     * @return void
     */
    public function up(): void
    {
        Schema::create('web_project_accounts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('project_id');
            $table->string('username', 64);
            $table->string('display_name', 120);
            $table->string('email')->nullable();
            $table->boolean('notify_email')->default(false);
            $table->string('language', 5)->default('cz');
            $table->string('password_hash');
            $table->timestamp('password_set_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'username'], 'uq_web_project_accounts_username');
            $table->foreign('project_id', 'fk_web_project_accounts_project_id')
                ->references('id')->on('web_projects')->cascadeOnDelete();
        });

        // Shared password of a project → its account "klient" (the hash is kept, so the password stays valid).
        $now = now();
        DB::table('web_projects')->orderBy('id')->select(['id', 'access_password_hash', 'password_generated_at'])
            ->chunk(200, function ($projects) use ($now) {
                $rows = [];
                foreach ($projects as $project) {
                    // Only a real password hash becomes an account (empty / placeholder values
                    // such as 'pending' never allowed a sign-in and are dropped).
                    if (!$project->access_password_hash || password_get_info($project->access_password_hash)['algoName'] === 'unknown') {
                        continue;
                    }
                    $rows[] = [
                        'project_id'      => $project->id,
                        'username'        => self::LEGACY_USERNAME,
                        'display_name'    => 'Klient',
                        'password_hash'   => $project->access_password_hash,
                        'password_set_at' => $project->password_generated_at,
                        'created_at'      => $now,
                        'updated_at'      => $now,
                    ];
                }
                if ($rows !== []) {
                    DB::table('web_project_accounts')->insert($rows);
                }
            });

        // A session now belongs to an account - the sessions of the shared password end (sign in again).
        DB::table('web_project_sessions')->delete();
        Schema::table('web_project_sessions', function (Blueprint $table) {
            $table->unsignedInteger('account_id')->after('project_id');
            $table->foreign('account_id', 'fk_web_project_sessions_account_id')
                ->references('id')->on('web_project_accounts')->cascadeOnDelete();
        });

        Schema::table('web_projects', function (Blueprint $table) {
            $table->dropColumn(['access_password_hash', 'password_generated_at']);
            $table->unsignedInteger('assignee_id')->nullable()->after('status');
            $table->foreign('assignee_id', 'fk_web_projects_assignee_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('web_project_threads', function (Blueprint $table) {
            $table->string('last_public_author', 20)->nullable()->after('opened_by');
        });
        // Author of the last message of every thread (all messages are public so far).
        DB::statement(
            'UPDATE web_project_threads SET last_public_author = (
                SELECT m.author_type FROM web_project_thread_messages m
                WHERE m.thread_id = web_project_threads.id ORDER BY m.id DESC LIMIT 1
            )'
        );

        Schema::table('web_project_thread_messages', function (Blueprint $table) {
            $table->unsignedInteger('account_id')->nullable()->after('author_label');
            $table->unsignedInteger('user_id')->nullable()->after('account_id');
            $table->boolean('is_internal')->default(false)->after('user_id');
            $table->foreign('account_id', 'fk_web_project_thread_messages_account_id')
                ->references('id')->on('web_project_accounts')->nullOnDelete();
            $table->foreign('user_id', 'fk_web_project_thread_messages_user_id')
                ->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('web_project_checkpoints', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('description');
            $table->text('internal_note')->nullable()->after('due_date');
        });
    }

    /**
     * @description Reverts: the shared password comes back from the oldest account of each
     *   project (projects without an account get an unusable one), the rest is dropped.
     * @return void
     */
    public function down(): void
    {
        Schema::table('web_project_checkpoints', function (Blueprint $table) {
            $table->dropColumn(['due_date', 'internal_note']);
        });

        Schema::table('web_project_thread_messages', function (Blueprint $table) {
            $table->dropForeign('fk_web_project_thread_messages_account_id');
            $table->dropForeign('fk_web_project_thread_messages_user_id');
            $table->dropColumn(['account_id', 'user_id', 'is_internal']);
        });

        Schema::table('web_project_threads', function (Blueprint $table) {
            $table->dropColumn('last_public_author');
        });

        Schema::table('web_projects', function (Blueprint $table) {
            $table->dropForeign('fk_web_projects_assignee_id');
            $table->dropColumn('assignee_id');
            $table->string('access_password_hash')->default('')->after('access_token');
            $table->timestamp('password_generated_at')->nullable()->after('access_password_hash');
        });
        foreach (DB::table('web_project_accounts')->orderBy('id')->get()->groupBy('project_id') as $projectId => $accounts) {
            DB::table('web_projects')->where('id', $projectId)->update([
                'access_password_hash'  => $accounts->first()->password_hash,
                'password_generated_at' => $accounts->first()->password_set_at,
            ]);
        }

        DB::table('web_project_sessions')->delete();
        Schema::table('web_project_sessions', function (Blueprint $table) {
            $table->dropForeign('fk_web_project_sessions_account_id');
            $table->dropColumn('account_id');
        });

        Schema::dropIfExists('web_project_accounts');
    }
};
