<?php
/**
 * @file ShopApp.php
 * @path app/Apps/Shop/ShopApp.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the e-shop application (catalogue, cart, checkout, orders, customers)
 * - everything the core needs to know about it. Registered in config/apps.php.
 * @dependencies AppManifest; ShopBaseDataSeeder, ShopRetentionSource, ShopAgendaSource, ShopLog,
 *   ShopOrderEmailTemplate, ShopProduct (sitemap).
 */

namespace App\Apps\Shop;

use App\Apps\Shop\Services\ShopAgendaSource;
use App\Apps\Shop\Services\ShopNotificationSource;
use App\Apps\Shop\Services\ShopRetentionSource;
use App\Apps\Shop\Http\Middleware\CheckShopActive;
use App\Apps\Shop\Models\ShopLog;
use App\Apps\Shop\Models\ShopProduct;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Support\Apps\AppAvailability;
use App\Support\Apps\AppManifest;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Apps\Shop\Database\Seeders\ShopBaseDataSeeder;
use App\Apps\Shop\Console\UnpaidOrdersCommand;
use Illuminate\Console\Scheduling\Schedule;

final class ShopApp extends AppManifest
{
    /** @description See AppManifest::id(). */
    public function id(): string
    {
        return 'shop';
    }

    /** @description See AppManifest::tabPermission(). */
    public function tabPermission(): string
    {
        return 'view-eshop';
    }

    /** @description See AppManifest::logModel(). */
    public function logModel(): string
    {
        return ShopLog::class;
    }

    /**
     * @description See AppManifest::middlewareAliases(). `shop.active` = the public catalogue and
     *   the checkout answer 503 while the e-shop is in maintenance mode.
     */
    public function middlewareAliases(): array
    {
        return ['shop.active' => CheckShopActive::class];
    }

    /** @description See AppManifest::commands(). */
    public function commands(): array
    {
        return [UnpaidOrdersCommand::class];
    }

    /**
     * @description See AppManifest::schedule() - unpaid bank-transfer orders every hour (reminder
     *   and cancellation on time, audit B-04).
     */
    public function schedule(Schedule $schedule): void
    {
        $schedule->command(UnpaidOrdersCommand::class)
            ->hourlyAt(20)
            ->withoutOverlapping()
            ->runInBackground();
    }

    /** @description See AppManifest::baseDataSeeders(). */
    public function baseDataSeeders(): array
    {
        return [ShopBaseDataSeeder::class];
    }

    /** @description See AppManifest::retentionSources(). */
    public function retentionSources(): array
    {
        return [ShopRetentionSource::class];
    }

    /** @description See AppManifest::agendaSources(). */
    public function agendaSources(): array
    {
        return [ShopAgendaSource::class];
    }

    /** @description See AppManifest::notificationSources(). */
    public function notificationSources(): array
    {
        return [ShopNotificationSource::class];
    }

    /** @description See AppManifest::translationPermission(). */
    public function translationPermission(): ?string
    {
        return 'shop-edit-eshop-update';
    }

    /** @description See AppManifest::languageDeleted() - texts of the order confirmation e-mail. */
    public function languageDeleted(string $code): void
    {
        ShopOrderEmailTemplate::forget(strtolower($code));
    }

    /**
     * @description See AppManifest::contentMissing() - the empty texts of the order e-mails
     *   (`order_email` - confirmation, payment reminder, cancellation; the customer would get
     *   Czech in their place).
     */
    public function contentMissing(string $code): array
    {
        $count = count(ShopOrderEmailTemplate::missingIn(ShopSiteSetting::query()->first() ?? new \stdClass(), strtolower($code)));

        return $count > 0 ? ['order_email' => $count] : [];
    }

    /**
     * @description See AppManifest::sitemapPaths() - the catalogue, every product on sale and the
     *   legal pages of the storefront (routes of erp/src/app/apps/shop/public/shop-public.routes.ts).
     *   The cart and the checkout are no content for search engines.
     * @return array<int, string>
     */
    public function sitemapPaths(): array
    {
        $products = ShopProduct::active()->orderBy('id')->get(['id', 'slug'])
            ->map(fn (ShopProduct $product) => '/shop/products/' . rawurlencode((string) ($product->slug ?: $product->id)));

        return array_values(array_merge(['/shop/catalog', '/shop/privacy-policy', '/shop/tos'], $products->all()));
    }

    /** @description See AppManifest::availability() - the switch of the storefront (shop/settings). */
    public function availability(): AppAvailability
    {
        $settings = ShopSiteSetting::query()->first();

        return new AppAvailability((bool) ($settings->is_shop_active ?? true), $settings?->maintenance_message);
    }
}
