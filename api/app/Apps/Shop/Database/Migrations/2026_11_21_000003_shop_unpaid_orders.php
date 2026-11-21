<?php
/**
 * @file 2026_11_21_000003_shop_unpaid_orders.php
 * @path api/app/Apps/Shop/Database/Migrations/2026_11_21_000003_shop_unpaid_orders.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unpaid orders paid by bank transfer (audit B-04, UnpaidOrders): the deadlines of the
 *   payment reminder and of the automatic cancellation (days after the order, 0 = off) and the
 *   start of the rule in shop_site_settings; the time the reminder of an order was sent; the Czech
 *   texts of the reminder / cancellation e-mails and of the payment details.
 * @note An existing installation gets `unpaid_orders_from` = now: orders placed before the rule
 *   existed are never reminded or cancelled automatically (they may be paid and only not marked
 *   as paid). The Czech texts are added to the stored Czech labels only when missing - an edit of
 *   the admin is never overwritten.
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Czech texts of the new e-mail labels (same as data/shop_order_email.php). */
    private const LABELS = [
        'payment_details_header' => 'Platební údaje',
        'label_account'          => 'Číslo účtu',
        'label_iban'             => 'IBAN',
        'label_swift'            => 'SWIFT / BIC',
        'label_variable_symbol'  => 'Variabilní symbol',
        'label_pay_by'           => 'Uhradit do',
        'reminder_subject'       => 'Připomínka platby objednávky',
        'reminder_intro'         => 'zatím jsme neobdrželi platbu za Vaši objednávku. Uhraďte ji prosím do níže uvedeného data, jinak objednávku zrušíme. Pokud jste již zaplatili, tento e-mail prosím ignorujte.',
        'canceled_subject'       => 'Zrušení objednávky',
        'canceled_intro'         => 'Vaši objednávku jsme zrušili, protože jsme za ni ve stanovené lhůtě neobdrželi platbu. Pokud o zboží stále máte zájem, objednejte ho prosím znovu.',
    ];

    /**
     * @description Adds the columns, the start of the rule and the Czech e-mail texts.
     * @return void
     */
    public function up(): void
    {
        Schema::table('shop_site_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('unpaid_reminder_days')->default(3)->after('maintenance_message')->comment('Payment reminder N days after the order (0 = off)');
            $table->unsignedTinyInteger('unpaid_cancel_days')->default(7)->after('unpaid_reminder_days')->comment('Automatic cancellation N days after the order (0 = off)');
            $table->dateTime('unpaid_orders_from')->nullable()->after('unpaid_cancel_days')->comment('Only orders placed since then are reminded / cancelled');
        });
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->dateTime('payment_reminder_sent_at')->nullable()->after('terms_hash')->comment('When the payment reminder was sent');
        });

        DB::table('shop_site_settings')->update(['unpaid_orders_from' => now()]);

        foreach (DB::table('shop_site_settings')->get(['id', 'order_email_labels_i18n']) as $row) {
            $labels = json_decode((string) $row->order_email_labels_i18n, true);
            if (!is_array($labels) || !isset($labels['cz']) || !is_array($labels['cz'])) {
                continue;
            }
            $labels['cz'] += self::LABELS;
            DB::table('shop_site_settings')->where('id', $row->id)->update(['order_email_labels_i18n' => json_encode($labels, JSON_UNESCAPED_UNICODE)]);
        }
    }

    /**
     * @description Drops the columns (the texts stay - harmless).
     * @return void
     */
    public function down(): void
    {
        Schema::table('shop_orders', function (Blueprint $table) {
            $table->dropColumn('payment_reminder_sent_at');
        });
        Schema::table('shop_site_settings', function (Blueprint $table) {
            $table->dropColumn(['unpaid_reminder_days', 'unpaid_cancel_days', 'unpaid_orders_from']);
        });
    }
};
