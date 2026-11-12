<?php
/**
 * @file 2026_11_21_000001_attachment_morph_aliases.php
 * @path api/database/migrations/2026_11_21_000001_attachment_morph_aliases.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The attachments (`web_attachments.attachable_type`) store the morph alias of their
 *   owner (AppManifest::morphMap(), e.g. `sales_order`) instead of the class name, so the models
 *   of an application can move without losing their files. Converts the existing rows.
 * @note The class names are written out (a migration must not depend on the classes). down()
 *   restores the class names.
 * @dependencies web_attachments
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @description Former class name => morph alias. */
    private const ALIASES = [
        'App\\Models\\Web\\WebJobApplication'        => 'job_application',
        'App\\Models\\Web\\WebRawRequestCommission'  => 'raw_request_commission',
        'App\\Models\\Web\\WebSalesOrder'            => 'sales_order',
        'App\\Models\\Web\\WebProjectThreadMessage'  => 'project_thread_message',
        'App\\Models\\Web\\WebProjectUpdate'         => 'project_update',
        'App\\Models\\Web\\WebProjectApproval'       => 'project_approval',
    ];

    /**
     * @description Class names → aliases.
     * @return void
     */
    public function up(): void
    {
        foreach (self::ALIASES as $class => $alias) {
            DB::table('web_attachments')->where('attachable_type', $class)->update(['attachable_type' => $alias]);
        }
    }

    /**
     * @description Aliases → class names.
     * @return void
     */
    public function down(): void
    {
        foreach (self::ALIASES as $class => $alias) {
            DB::table('web_attachments')->where('attachable_type', $alias)->update(['attachable_type' => $class]);
        }
    }
};
