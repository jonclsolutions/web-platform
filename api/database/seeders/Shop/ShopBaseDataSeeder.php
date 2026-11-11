<?php
/**
 * @file ShopBaseDataSeeder.php
 * @path api/database/seeders/Shop/ShopBaseDataSeeder.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base data of the e-shop module (registered in config/seeders.php, run by
 *   BaseDataSeeder): the e-shop permission keys incl. the tab permission `view-eshop`
 *   (data/permissions.php), the browser tab titles of the e-shop pages (data/page_titles.php), the
 *   default row of the e-shop settings with the Czech texts of the order confirmation e-mail
 *   (data/shop_site_settings.php + data/shop_order_email.php), the payment methods (the admin can
 *   only edit them, not create or delete - data/shop_payment_methods.php) and the default shipping
 *   method "store pickup" (data/shop_shipping_methods.php) - so the checkout works from the start -
 *   plus the flag of the built-in language of the e-shop translations and neutral icons of the
 *   payment methods (assets/payment-methods).
 * @note Idempotent and never destructive: methods are added by code (deleted ones included - a
 *   method deleted in the admin stays deleted; edited methods stay as they are).
 * @dependencies ShopSiteSetting, ShopPaymentMethod, ShopShippingMethod, ModuleBaseDataSeeder.
 */

namespace Database\Seeders\Shop;

use App\Models\Shop\ShopPaymentMethod;
use App\Models\Shop\ShopShippingMethod;
use App\Models\Shop\ShopSiteSetting;
use Database\Seeders\ModuleBaseDataSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ShopBaseDataSeeder extends ModuleBaseDataSeeder
{
    /** Flag of the built-in language of the e-shop translations (public disk, see languages.json). */
    public const FLAG_PATH = 'translation_images/shop/czech-republic-default.png';

    /** Folder of the payment method images on the public disk (former logos and the default icons). */
    public const PAYMENT_IMAGE_FOLDER = 'payment-methods-images';

    /** @description See ModuleBaseDataSeeder::moduleDir(). */
    protected static function moduleDir(): string
    {
        return __DIR__;
    }

    /** @description See ModuleBaseDataSeeder::run(). */
    public function run(): void
    {
        DB::transaction(function () {
            self::addPermissions(self::permissions());
            self::addPageTitles(self::data('page_titles'));
            if (!ShopSiteSetting::query()->exists()) {
                ShopSiteSetting::create(self::data('shop_site_settings'));
            }
            $this->seedMethods();
        });

        $files = [self::FLAG_PATH => self::FLAG_ASSET];
        foreach (glob(__DIR__ . '/assets/payment-methods/*.svg') ?: [] as $icon) {
            $files[self::PAYMENT_IMAGE_FOLDER . '/default-' . basename($icon)] = $icon;
        }
        self::copyToPublicDisk($files);
    }

    /**
     * @description Adds the payment methods and the default shipping method that do not exist
     *   yet. A payment method gets its former logo when the file is on the public disk, otherwise
     *   its default icon (copied by run()).
     * @return void
     */
    private function seedMethods(): void
    {
        $disk = Storage::disk('public');
        foreach (self::data('shop_payment_methods') as $method) {
            if (ShopPaymentMethod::withTrashed()->where('code', $method['code'])->exists()) {
                continue;
            }
            $image = $disk->exists($method['image'])
                ? $method['image']
                : self::PAYMENT_IMAGE_FOLDER . '/default-' . $method['default_image'];
            ShopPaymentMethod::create(array_diff_key($method, ['image' => 1, 'default_image' => 1]) + ['price' => 0, 'image_path' => $image]);
        }

        foreach (self::data('shop_shipping_methods') as $method) {
            if (!ShopShippingMethod::withTrashed()->where('code', $method['code'])->exists()) {
                ShopShippingMethod::create($method);
            }
        }
    }
}
