<?php
/**
 * @file 2026_11_21_000000_remove_web_news_and_support_tickets.php
 * @path api/database/migrations/2026_11_21_000000_remove_web_news_and_support_tickets.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Removes the news and the helpdesk (support tickets) completely: the tables
 *   `web_news` and `web_support_tickets`, the attachments of the tickets (rows of
 *   `web_attachments` and their files on the private disk, legacy single files on the public
 *   disk), the permissions `web-news-*` / `web-support-tickets-*` with their role / user
 *   assignments and the retention setting `support_tickets`.
 * @note The data are deleted for good (tickets hold personal data). down() creates the empty
 *   tables again - records, files and permissions are not restored (the permission seeder no
 *   longer knows the keys).
 * @dependencies web_attachments, core_permissions, core_role_permissions, user_permissions,
 *   core_retention_settings
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /** @description Morph type the ticket attachments were stored with. */
    private const TICKET_TYPE = 'App\\Models\\Web\\WebSupportTicket';

    /** @description Upload folder of the ticket attachments on the private disk. */
    private const TICKET_FOLDER = 'web/tickets';

    /** @description Prefixes of the removed permission keys. */
    private const PERMISSION_PREFIXES = ['web-news-', 'web-support-tickets-'];

    /**
     * @description Deletes the files, attachment rows, permissions, retention setting and tables.
     * @return void
     */
    public function up(): void
    {
        $private = Storage::disk('private');
        foreach (DB::table('web_attachments')->where('attachable_type', self::TICKET_TYPE)->get(['disk', 'path']) as $file) {
            Storage::disk($file->disk ?: 'private')->delete($file->path);
        }
        DB::table('web_attachments')->where('attachable_type', self::TICKET_TYPE)->delete();
        $private->deleteDirectory(self::TICKET_FOLDER);

        if (Schema::hasTable('web_support_tickets')) {
            foreach (DB::table('web_support_tickets')->whereNotNull('attachment_path')->pluck('attachment_path') as $legacy) {
                Storage::disk('public')->delete($legacy);
            }
        }

        $ids = DB::table('core_permissions')
            ->where(fn ($query) => collect(self::PERMISSION_PREFIXES)->each(fn ($prefix) => $query->orWhere('permission_key', 'like', $prefix . '%')))
            ->pluck('id');
        DB::table('core_role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('user_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('core_permissions')->whereIn('id', $ids)->delete();

        DB::table('core_retention_settings')->where('data_key', 'support_tickets')->delete();

        Schema::dropIfExists('web_support_tickets');
        Schema::dropIfExists('web_news');
    }

    /**
     * @description Creates the two tables again (empty).
     * @return void
     */
    public function down(): void
    {
        Schema::create('web_news', function (Blueprint $table) {
            $table->increments('id');
            $table->string('title');
            $table->string('message', 10000);
            $table->string('author');
            $table->string('thema');
            foreach ([1, 2, 3, 4] as $n) {
                $table->string("bullet_{$n}")->nullable();
            }
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('web_support_tickets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('user_name_plain');
            $table->string('user_plain');
            $table->string('category', 100);
            $table->string('priority', 50)->nullable()->default('medium');
            $table->string('state', 50)->nullable()->default('new');
            $table->string('subject');
            $table->text('description');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->foreign('user_id', 'fk_web_support_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }
};
