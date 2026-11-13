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
 *   ShopOrderEmailTemplate.
 */

namespace App\Apps\Shop;

use App\Apps\Shop\Services\ShopAgendaSource;
use App\Apps\Shop\Services\ShopRetentionSource;
use App\Apps\Shop\Http\Middleware\CheckShopActive;
use App\Apps\Shop\Models\ShopLog;
use App\Support\Apps\AppManifest;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Apps\Shop\Database\Seeders\ShopBaseDataSeeder;

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
}
