<?php

/**
 * @file OrderConfirmationEmailTest.php
 * @path api/tests/Feature/Shop/OrderConfirmationEmailTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the e-shop order confirmation e-mail (Directive 2011/83/EU,
 *   Art. 8(7)): sent after the checkout in the language of the storefront (an unknown language =
 *   Czech), its content (order number, items, prices, shipping / payment, delivery address,
 *   right of withdrawal, terms link), the texts of the admin with the language fallback, a failed
 *   e-mail never failing the order, the admin template API (permission, clean-up) and the texts of
 *   a deleted e-shop language removed.
 * @dependencies
 * - Tests\TestCase, Tests\Support\ShopFixtures; Mail fake; a temporary storage folder with the
 *   e-shop languages cz + en.
 */

namespace Tests\Feature\Shop;

use App\Mail\Shop\ShopOrderConfirmation;
use App\Models\Shop\ShopLog;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopSiteSetting;
use App\Support\Mail\ShopOrderEmailTemplate;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Mail;
use Tests\Support\ShopFixtures;
use Tests\TestCase;

/**
 * @description /api/shop/checkout/create-order (e-mail), /api/shop/settings/order-email-template.
 */
class OrderConfirmationEmailTest extends TestCase
{
    use ShopFixtures;

    /** @var string Temporary storage directory of the test. */
    private string $storage;

    /** @var array<string, int>|null Ids of the product "Mug" and the methods of the orders (created once). */
    private ?array $ids = null;

    /**
     * @description Own storage with the e-shop languages cz + en; the frontend URL of the links.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->storage = sys_get_temp_dir() . '/shop-mail-test-' . bin2hex(random_bytes(6));
        mkdir($this->storage . '/app/public/translations/shop', 0777, true);
        file_put_contents($this->storage . '/app/public/translations/languages.json', json_encode([
            ['code' => 'cz', 'module' => 'shop', 'name' => 'Čeština', 'active' => true, 'isBuiltIn' => true],
            ['code' => 'en', 'module' => 'shop', 'name' => 'English', 'active' => true],
            ['code' => 'de', 'module' => 'web', 'name' => 'Deutsch', 'active' => true],
        ]));
        $this->app->useStoragePath($this->storage);
        config(['app.frontend_url' => 'https://shop.example.com/']);
    }

    /**
     * @description Removes the temporary storage.
     * @return void
     */
    protected function tearDown(): void
    {
        File::deleteDirectory($this->storage);
        parent::tearDown();
    }

    /**
     * @description Places an order of 2 × "Mug" (121 EUR) with the coupon SAVE10 through the
     *   public checkout.
     * @param array<string, mixed> $overrides Fields of the checkout body.
     * @return \Illuminate\Testing\TestResponse
     */
    private function checkout(array $overrides = [])
    {
        if ($this->ids === null) {
            $this->ids = ['mug' => $this->product(['name' => 'Mug'])->id, 'payment' => $this->paymentMethod()->id, 'shipping' => $this->shippingMethod()->id];
            $this->coupon();
        }

        return $this->postJson('/api/shop/checkout/create-order', array_merge([
            'email' => 'Jan@Example.com', 'first_name' => 'Jan', 'last_name' => 'Novák', 'phone' => '777111222',
            'address' => 'Hlavní 1', 'city' => 'Praha', 'postal_code' => '11000', 'country' => 'CZ',
            'payment_method_id' => $this->ids['payment'], 'shipping_method_id' => $this->ids['shipping'],
            'coupon_code' => 'SAVE10', 'notes' => "Ring twice\nThanks",
            'items' => [['product_id' => $this->ids['mug'], 'quantity' => 2]],
        ], $overrides));
    }

    /**
     * @description The checkout queues the confirmation to the buyer in the language of the
     *   storefront; the e-mail carries the whole order and the legal information.
     * @input Checkout in 'en' with 2 × Mug, coupon 10 %, shipping PPL 5 EUR, a two-line note.
     * @output 201; order lang 'en'; one ShopOrderConfirmation to jan@example.com; subject
     *   "Order confirmation <number>"; html lang en; number, "Mug", 2, 121.00 €, 242.00 €,
     *   −24.20 € (SAVE10), PPL 5.00 €, Bank transfer, total 222.80 €, address, contact, the note,
     *   withdrawal text, terms link https://shop.example.com/tos.
     */
    public function test_checkout_sends_the_confirmation_in_the_storefront_language(): void
    {
        Mail::fake();
        $number = $this->checkout(['lang' => 'EN'])->assertCreated()->json('data.order_number');
        $order = ShopOrder::where('order_number', $number)->firstOrFail();
        $this->assertSame('en', $order->lang);

        Mail::assertQueued(ShopOrderConfirmation::class, 1);
        Mail::assertQueued(ShopOrderConfirmation::class, function (ShopOrderConfirmation $mail) use ($order, $number) {
            $html = $mail->render();
            $mail->assertHasTo('jan@example.com');
            $mail->assertHasSubject("Order confirmation {$number}");
            foreach (['<html lang="en">', $number, 'Mug', '121.00', '242.00', '−24.20', 'SAVE10', 'PPL', '5.00', 'Bank transfer',
                '222.80', 'Hlavní 1', '11000 Praha', 'jan@example.com', '777111222', 'Jan Novák', 'Ring twice', 'within 14 days',
                'href="https://shop.example.com/tos"', 'Terms and conditions', 'Total incl. VAT'] as $expected) {
                $this->assertStringContainsString($expected, $html, $expected);
            }

            return $mail->order->is($order);
        });
    }

    /**
     * @description A language the e-shop does not have (or none) is stored as Czech; Czech
     *   amounts use a decimal comma.
     * @input Checkout with lang 'xx'; without lang.
     * @output lang 'cz' both times; the e-mail in Czech format ("242,00 €", html lang cs).
     */
    public function test_unknown_language_falls_back_to_czech(): void
    {
        Mail::fake();
        $first = $this->checkout(['lang' => 'xx'])->assertCreated()->json('data.order_number');
        $second = $this->checkout(['email' => 'eva@example.com'])->assertCreated()->json('data.order_number');

        $this->assertSame(['cz', 'cz'], ShopOrder::whereIn('order_number', [$first, $second])->pluck('lang')->all());
        Mail::assertQueued(ShopOrderConfirmation::class, function (ShopOrderConfirmation $mail) {
            $html = $mail->render();
            return str_contains($html, '242,00') && str_contains($html, '<html lang="cs">');
        });
    }

    /**
     * @description The texts of the admin: the language of the order, otherwise Czech, otherwise
     *   the built-in default - for every text and label.
     * @input Template: cz subject / intro / label_total / withdrawal; en subject only. Order in en.
     * @output subject 'Order no.' (en); intro and label_total from cz; label_product default
     *   'Product'; withdrawal from cz.
     */
    public function test_texts_use_the_language_fallback(): void
    {
        ShopSiteSetting::create([
            'is_shop_active' => true,
            'order_email_subject_i18n' => ['cz' => 'Potvrzení objednávky', 'en' => 'Order no.'],
            'order_email_intro_i18n' => ['cz' => 'děkujeme za objednávku.'],
            'order_email_labels_i18n' => ['cz' => ['label_total' => 'Celkem s DPH', 'withdrawal_info' => 'Do 14 dnů můžete odstoupit.']],
        ]);

        $texts = ShopOrderEmailTemplate::forLang('en');
        $this->assertSame('Order no.', $texts['subject']);
        $this->assertSame('děkujeme za objednávku.', $texts['intro']);
        $this->assertSame('Celkem s DPH', $texts['labels']['label_total']);
        $this->assertSame('Product', $texts['labels']['label_product']);
        $this->assertSame('Do 14 dnů můžete odstoupit.', $texts['labels']['withdrawal_info']);
        $this->assertSame(ShopOrderEmailTemplate::DEFAULTS['title'], $texts['title']);
    }

    /**
     * @description A failed e-mail never fails the order - it is logged.
     * @input Mailer throws on to().
     * @output 201; the order exists; ShopLog error "Failed to send the order confirmation e-mail".
     */
    public function test_failed_email_does_not_fail_the_order(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP down'));

        $number = $this->checkout()->assertCreated()->json('data.order_number');

        $this->assertTrue(ShopOrder::where('order_number', $number)->exists());
        $this->assertTrue(ShopLog::where('event_type', 'error')->where('description', 'like', 'Failed to send the order confirmation e-mail%')->exists());
    }

    /**
     * @description The template API needs shop-orders-update; it keeps only the e-shop languages
     *   and the known labels, plain text (line breaks only in intro / outro / withdrawal_info) and
     *   drops empty texts; the answer is the stored template.
     * @input No permission: GET; with it: GET empty, PUT with cz / en / de (web-only) / xx texts,
     *   a tag, an unknown label, a two-line withdrawal text, an empty en intro.
     * @output 403; {} objects; saved subject {cz, en}; title without the tag; intro {cz};
     *   labels cz {label_total, withdrawal_info with its line break}; log entry.
     */
    public function test_admin_template_api(): void
    {
        $this->signIn($this->userWith(['shop-orders-view']));
        $this->getJson('/api/shop/settings/order-email-template')->assertForbidden();

        $this->signIn($this->userWith(['shop-orders-update']));
        $this->getJson('/api/shop/settings/order-email-template')->assertOk()
            ->assertExactJson(['data' => array_fill_keys(ShopOrderEmailTemplate::FIELDS, [])]);

        $data = $this->putJson('/api/shop/settings/order-email-template', [
            'order_email_subject_i18n' => ['cz' => 'Potvrzení', 'en' => 'Confirmation', 'de' => 'Bestätigung', 'xx' => 'X'],
            'order_email_title_i18n'   => ['cz' => '<b>Děkujeme</b>'],
            'order_email_intro_i18n'   => ['cz' => "Řádek 1\nŘádek 2", 'en' => '  '],
            'order_email_labels_i18n'  => ['cz' => ['label_total' => 'Celkem', 'unknown' => 'x', 'withdrawal_info' => "A\nB"], 'de' => ['label_total' => 'Summe']],
        ])->assertOk()->json('data');

        $this->assertSame(['cz' => 'Potvrzení', 'en' => 'Confirmation'], $data['order_email_subject_i18n']);
        $this->assertSame(['cz' => 'Děkujeme'], $data['order_email_title_i18n']);
        $this->assertSame(['cz' => "Řádek 1\nŘádek 2"], $data['order_email_intro_i18n']);
        $this->assertSame(['cz' => ['label_total' => 'Celkem', 'withdrawal_info' => "A\nB"]], $data['order_email_labels_i18n']);
        $this->assertShopLog('update', 'order confirmation e-mail template');
    }

    /**
     * @description Deleting an e-shop language deletes its texts of the e-mail template.
     * @input Template with cz + en texts; DELETE languages/shop/en.
     * @output Only cz texts left (subject, labels).
     */
    public function test_deleted_language_loses_its_texts(): void
    {
        ShopSiteSetting::create([
            'is_shop_active' => true,
            'order_email_subject_i18n' => ['cz' => 'Potvrzení', 'en' => 'Confirmation'],
            'order_email_labels_i18n' => ['cz' => ['label_total' => 'Celkem'], 'en' => ['label_total' => 'Total']],
        ]);
        $this->signIn($this->userWith(['shop-edit-eshop-update']));

        $this->deleteJson('/api/languages/shop/en')->assertNoContent();

        $settings = ShopSiteSetting::first();
        $this->assertSame(['cz' => 'Potvrzení'], $settings->order_email_subject_i18n);
        $this->assertSame(['cz' => ['label_total' => 'Celkem']], $settings->order_email_labels_i18n);
    }

    /**
     * @description The migration fills the Czech texts of the e-mail into the existing settings
     *   row (its other settings kept); without a row it creates none (BaseDataSeeder does, with
     *   the same texts).
     * @input An inactive row with a message: down() + up(); then no row: down() + up().
     * @output Row still inactive, message kept, Czech subject / labels; then no row.
     */
    public function test_migration_fills_in_the_czech_texts(): void
    {
        $migration = require database_path('migrations/2026_11_14_000000_shop_order_confirmation_email.php');
        ShopSiteSetting::create(['is_shop_active' => false, 'maintenance_message' => 'Inventory']);
        $migration->down();
        $migration->up();

        $settings = ShopSiteSetting::sole();
        $this->assertSame([false, 'Inventory'], [$settings->is_shop_active, $settings->maintenance_message]);
        $this->assertSame(['cz' => 'Potvrzení objednávky'], $settings->order_email_subject_i18n);
        $texts = ShopOrderEmailTemplate::forLang('en');
        $this->assertSame('Celkem k úhradě vč. DPH', $texts['labels']['label_total']);
        $this->assertSame('Obchodní podmínky', $texts['labels']['terms_link']);

        ShopSiteSetting::query()->delete();
        $migration->down();
        $migration->up();
        $this->assertSame(0, ShopSiteSetting::count());
    }
}
