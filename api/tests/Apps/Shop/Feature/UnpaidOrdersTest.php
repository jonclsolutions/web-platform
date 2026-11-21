<?php

/**
 * @file UnpaidOrdersTest.php
 * @path api/tests/Apps/Shop/Feature/UnpaidOrdersTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the unpaid bank-transfer orders (audit B-04, UnpaidOrders,
 *   `shop:unpaid-orders`): the reminder after N days (once), the automatic cancellation after M
 *   days (stock incl. variants and the coupon use returned, e-mail, log), the orders left alone
 *   (other payment, confirmed, paid, placed before the rule), the deadlines (0 = off, dry run),
 *   the admin API of the deadlines, the e-mails (pay-by day, payment details - also in the
 *   order confirmation), the migration of the Czech texts and the scheduled job.
 * @dependencies
 * - Tests\TestCase, ShopFixtures, CommonFixtures; Mail fake; time travel.
 */

namespace Tests\Apps\Shop\Feature;

use App\Apps\Shop\Mail\ShopOrderCanceled;
use App\Apps\Shop\Mail\ShopOrderConfirmation;
use App\Apps\Shop\Mail\ShopPaymentReminder;
use App\Apps\Shop\Models\ShopOrder;
use App\Apps\Shop\Models\ShopPaymentMethod;
use App\Apps\Shop\Models\ShopSiteSetting;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Mail;
use Tests\Apps\Shop\Support\ShopFixtures;
use Tests\Support\CommonFixtures;
use Tests\TestCase;

/**
 * @description UnpaidOrders, shop:unpaid-orders, /api/shop/settings/unpaid-orders, the e-mails.
 */
class UnpaidOrdersTest extends TestCase
{
    use ShopFixtures;
    use CommonFixtures;

    /** @var ShopPaymentMethod Bank transfer with an account, IBAN and the order number as VS. */
    private ShopPaymentMethod $bank;

    /**
     * @description Settings with the defaults (3 / 7 days), the Czech texts; a bank transfer.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $texts = require app_path('Apps/Shop/Database/Seeders/data/shop_order_email.php');
        ShopSiteSetting::create(['is_shop_active' => true, 'order_email_labels_i18n' => $texts['order_email_labels_i18n']]);
        $this->bank = $this->paymentMethod([
            'code' => 'bank_transfer_cz', 'name' => 'Bankovní převod', 'bank_account_number' => '123456789', 'bank_account_code' => '0100',
            'bank_iban' => 'CZ6501000000000123456789', 'bank_swift_bic' => 'KOMBCZPP', 'variable_symbol_type' => 'order_number',
        ]);
    }

    /**
     * @description An order placed `$days` days ago.
     * @param int $days Age in days.
     * @param array<string, mixed> $attributes Column overrides (default: the bank transfer).
     * @param array $items Items (see ShopFixtures::order()).
     * @return ShopOrder
     */
    private function placed(int $days, array $attributes = [], array $items = []): ShopOrder
    {
        $this->travelTo(now()->subDays($days));
        $order = $this->order(null, $attributes + ['payment_method_id' => $this->bank->id, 'customer_email' => "o{$days}" . uniqid() . '@example.com', 'lang' => 'cz'], $items);
        $this->travelBack();

        return $order;
    }

    /**
     * @description Day 4 → one reminder; day 8 → cancelled: canceled / unpaid, the pieces back in
     *   stock (product and variant), the coupon use returned, e-mail, log. Orders left alone: day
     *   1, another payment method, confirmed, paid. A second run does nothing.
     * @input Orders: A 4 d; B 8 d (2 × product, 1 × variant, coupon used once); C 1 d; D card 8 d;
     *   E confirmed 8 d; F paid 8 d; run twice.
     * @output "Reminded: 1, canceled: 1."; reminder to A (sent_at set), cancellation to B; stock
     *   5 → 7, variant 3 → 4, coupon 1 → 0; C-F unchanged; logs; second run 0 / 0, no new e-mail.
     */
    public function test_reminds_and_cancels_unpaid_bank_transfers(): void
    {
        Mail::fake();
        $product = $this->product(['name' => 'Mug', 'stock_quantity' => 5]);
        $parent = $this->product(['name' => 'Shirt']);
        $variant = $this->variant($parent, ['variant_name' => 'M', 'stock_quantity' => 3]);
        $coupon = $this->coupon(['code' => 'SAVE', 'usage_count' => 1]);
        $card = $this->paymentMethod(['code' => 'stripe_card', 'name' => 'Card', 'provider' => 'stripe']);

        $a = $this->placed(4);
        $b = $this->placed(8, ['coupon_id' => $coupon->id], [[$product, 2], [$parent, 1, $variant]]);
        $untouched = [
            $this->placed(1),
            $this->placed(8, ['payment_method_id' => $card->id]),
            $this->placed(8, ['status' => 'confirmed']),
            $this->placed(8, ['payment_status' => 'paid']),
        ];

        $this->artisan('shop:unpaid-orders')->expectsOutput('Reminded: 1, canceled: 1.')->assertSuccessful();

        Mail::assertQueued(ShopPaymentReminder::class, fn ($mail) => $mail->order->is($a) && $mail->hasTo($a->customer_email));
        Mail::assertQueued(ShopOrderCanceled::class, fn ($mail) => $mail->order->is($b) && $mail->hasTo($b->customer_email));
        Mail::assertQueuedCount(2);
        $this->assertNotNull($a->fresh()->payment_reminder_sent_at);
        $this->assertSame(['canceled', 'unpaid'], [$b->fresh()->status, $b->fresh()->payment_status]);
        $this->assertSame([7, 4, 0], [$product->fresh()->stock_quantity, $variant->fresh()->stock_quantity, $coupon->fresh()->usage_count]);
        foreach ($untouched as $order) {
            $fresh = $order->fresh();
            $this->assertSame([$order->status, $order->payment_status, null], [$fresh->status, $fresh->payment_status, $fresh->payment_reminder_sent_at]);
        }
        $this->assertShopLog('payment_reminder', $a->order_number);
        $this->assertShopLog('auto_cancel', $b->order_number);

        $this->artisan('shop:unpaid-orders')->expectsOutput('Reminded: 0, canceled: 0.');
        Mail::assertQueuedCount(2);
    }

    /**
     * @description Deadlines: the dry run counts without changes; 0 switches a step off (no
     *   cancellation → an old order still gets the reminder); orders placed before the rule
     *   (`unpaid_orders_from`) are left alone.
     * @input Orders 4 d and 8 d: --dry-run; cancel 0; then from = 2 days ago, an order 3 d.
     * @output dry run 1 / 1 and nothing changed or sent; cancel off: 2 reminders, nothing
     *   cancelled; from: the 3-day order before the start is skipped (0 / 0).
     */
    public function test_deadlines_dry_run_and_start(): void
    {
        Mail::fake();
        $four = $this->placed(4);
        $eight = $this->placed(8);

        $this->artisan('shop:unpaid-orders', ['--dry-run' => true])->expectsOutput('[dry run] Reminded: 1, canceled: 1.');
        Mail::assertNothingQueued();
        $this->assertSame(['pending', null], [$eight->fresh()->status, $four->fresh()->payment_reminder_sent_at]);

        ShopSiteSetting::first()->update(['unpaid_cancel_days' => 0]);
        $this->artisan('shop:unpaid-orders')->expectsOutput('Reminded: 2, canceled: 0.');
        $this->assertSame('pending', $eight->fresh()->status);

        ShopSiteSetting::first()->update(['unpaid_orders_from' => now()->subDays(2)]);
        $this->placed(3);
        $this->artisan('shop:unpaid-orders')->expectsOutput('Reminded: 0, canceled: 0.');
    }

    /**
     * @description The reminder (Czech): subject with the number, intro, total, pay-by day =
     *   order + 7 days, payment details (account/bank code, IBAN, SWIFT, VS = order number). The
     *   cancellation: its subject and intro, no payment details. The order confirmation of a bank
     *   transfer shows the payment details, of a card payment not.
     * @input An order of 6 Nov 2026 10:00 paid by bank transfer; one paid by card.
     * @output texts as described; "13.11.2026"; "123456789/0100".
     */
    public function test_emails_of_an_unpaid_order(): void
    {
        $this->travelTo(now()->setDate(2026, 11, 6)->setTime(10, 0));
        $order = $this->order(null, ['payment_method_id' => $this->bank->id, 'customer_first_name' => 'Jan', 'lang' => 'cz']);
        $this->travelBack();

        $reminder = new ShopPaymentReminder($order);
        $this->assertSame('Připomínka platby objednávky ' . $order->order_number, $reminder->envelope()->subject);
        $html = $reminder->render();
        foreach (['zatím jsme neobdrželi platbu', 'Uhradit do', '13.11.2026', '121,00', 'Platební údaje', '123456789/0100', 'CZ6501000000000123456789', 'KOMBCZPP', 'Variabilní symbol', $order->order_number] as $expected) {
            $this->assertStringContainsString($expected, $html, $expected);
        }

        $canceled = new ShopOrderCanceled($order);
        $this->assertSame('Zrušení objednávky ' . $order->order_number, $canceled->envelope()->subject);
        $html = $canceled->render();
        $this->assertStringContainsString('Vaši objednávku jsme zrušili', $html);
        $this->assertStringNotContainsString('Platební údaje', $html);

        $this->assertStringContainsString('123456789/0100', (new ShopOrderConfirmation($order))->render());
        $card = $this->order(null, ['payment_method_id' => $this->paymentMethod(['code' => 'stripe_card', 'name' => 'Card'])->id]);
        $this->assertStringNotContainsString('Platební údaje', (new ShopOrderConfirmation($card))->render());
    }

    /**
     * @description Payment details: the variable symbol by the type of the method (order number;
     *   phone digits, with a country code shortened to the national 9 digits; none); nothing for
     *   a method that is not a bank transfer or a transfer without an account / IBAN.
     * @input Order with phone "+420 777 111 222"; types order_number / phone_number / none; phone
     *   "777 111 222"; method code "bank_transfer"; bank transfer without account and IBAN.
     * @output order number; "777111222" twice; no VS row; [] twice.
     */
    public function test_payment_details_and_variable_symbol(): void
    {
        $order = $this->order(null, ['payment_method_id' => $this->bank->id, 'customer_email' => 'p@example.com', 'customer_phone' => '+420 777 111 222']);
        $this->assertSame(['label_account' => '123456789/0100', 'label_iban' => 'CZ6501000000000123456789', 'label_swift' => 'KOMBCZPP', 'label_variable_symbol' => $order->order_number], $this->bank->paymentDetails($order));

        $this->bank->update(['variable_symbol_type' => 'phone_number']);
        $this->assertSame('777111222', $this->bank->variableSymbol($order));
        $order->update(['customer_phone' => '777 111 222']);
        $this->assertSame('777111222', $this->bank->variableSymbol($order));
        $this->bank->update(['variable_symbol_type' => 'none']);
        $this->assertArrayNotHasKey('label_variable_symbol', $this->bank->paymentDetails($order));

        $this->assertSame([], $this->paymentMethod(['code' => 'bank_transfer', 'bank_iban' => 'CZ65'])->paymentDetails($order));
        $this->bank->update(['bank_account_number' => null, 'bank_iban' => '']);
        $this->assertSame([], $this->bank->paymentDetails($order));
    }

    /**
     * @description Admin API of the deadlines (shop-orders-update): read, save with a log entry;
     *   whole days 0-60, the reminder before the cancellation.
     * @input Without permission; GET; PUT 2 / 5; 5 / 5; 61 / 5; 0 / 0.
     * @output 403; 3 / 7; saved 2 / 5 + log; 422 reminder; 422 days; 0 / 0 saved (both off).
     */
    public function test_admin_api_of_the_deadlines(): void
    {
        $this->signIn($this->userWith(['shop-orders-view']));
        $this->getJson('/api/shop/settings/unpaid-orders')->assertForbidden();

        $this->signIn($this->userWith(['shop-orders-update']));
        $this->getJson('/api/shop/settings/unpaid-orders')->assertOk()->assertExactJson(['data' => ['unpaid_reminder_days' => 3, 'unpaid_cancel_days' => 7]]);
        $this->putJson('/api/shop/settings/unpaid-orders', ['unpaid_reminder_days' => 2, 'unpaid_cancel_days' => 5])->assertOk()
            ->assertJsonPath('data.unpaid_cancel_days', 5);
        $this->assertSame([2, 5], [ShopSiteSetting::first()->unpaid_reminder_days, ShopSiteSetting::first()->unpaid_cancel_days]);
        $this->assertShopLog('update', 'reminder 2 d, cancellation 5 d');

        $this->putJson('/api/shop/settings/unpaid-orders', ['unpaid_reminder_days' => 5, 'unpaid_cancel_days' => 5])->assertStatus(422)->assertJsonValidationErrors(['unpaid_reminder_days']);
        $this->putJson('/api/shop/settings/unpaid-orders', ['unpaid_reminder_days' => 61, 'unpaid_cancel_days' => 5])->assertStatus(422)->assertJsonValidationErrors(['unpaid_reminder_days']);
        $this->putJson('/api/shop/settings/unpaid-orders', ['unpaid_reminder_days' => 0, 'unpaid_cancel_days' => 0])->assertOk()->assertJsonPath('data.unpaid_reminder_days', 0);
    }

    /**
     * @description The migration adds the missing Czech texts (an edit of the admin is kept) and
     *   the start of the rule; the job is scheduled every hour.
     * @input Stored cz labels with an edited reminder subject; down() + up(); the schedule.
     * @output the edited subject kept, the cancellation subject added, unpaid_orders_from set;
     *   "shop:unpaid-orders" at minute 20 of every hour.
     */
    public function test_migration_and_schedule(): void
    {
        $migration = require app_path('Apps/Shop/Database/Migrations/2026_11_21_000003_shop_unpaid_orders.php');
        $settings = ShopSiteSetting::first();
        $settings->update(['order_email_labels_i18n' => ['cz' => ['reminder_subject' => 'Zaplaťte prosím']]]);
        $migration->down();
        $migration->up();
        $fresh = $settings->fresh();
        $this->assertSame(['Zaplaťte prosím', 'Zrušení objednávky'], [$fresh->order_email_labels_i18n['cz']['reminder_subject'], $fresh->order_email_labels_i18n['cz']['canceled_subject']]);
        $this->assertNotNull($fresh->unpaid_orders_from);

        $events = collect(app(Schedule::class)->events())->filter(fn ($event) => str_contains((string) $event->command, 'shop:unpaid-orders'));
        $this->assertSame(['20 * * * *'], $events->pluck('expression')->values()->all());
    }
}
