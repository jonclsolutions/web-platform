<?php
/**
 * @file ShopSiteSettingController.php
 * @path app/Apps/Shop/Http/Controllers/ShopSiteSettingController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manages e-shop maintenance mode - toggling storefront/checkout availability
 * and the customer-facing maintenance message, with mandatory password re-confirmation
 * for the write action and a public read-only endpoint for the storefront. Also the editable
 * texts of the order confirmation e-mail (per language, ShopOrderEmailTemplate).
 */

namespace App\Apps\Shop\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Shop\Models\ShopLog;
use App\Http\Controllers\Api\TranslationController;
use App\Support\I18n\I18nText;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;

/**
 * @description Controller responsible for e-shop-wide maintenance status settings.
 * @note Uses Cache invalidation (`site_setting_active_shop`) so `CheckShopActive`
 * middleware and the public status endpoint react instantly to configuration changes.
 */
class ShopSiteSettingController extends Controller
{
    use LogsActivity;

    /**
     * @description Cache key shared with `CheckShopActive` middleware - must stay in sync.
     */
    private const CACHE_KEY = 'site_setting_active_shop';

    /** @description Maximum characters per language of the template texts. */
    private const TEMPLATE_LIMITS = ['subject' => 150, 'title' => 150, 'intro' => 2000, 'outro' => 2000];
    private const LABEL_LIMIT = 200;
    private const WITHDRAWAL_LIMIT = 1500;

    /**
     * Retrieves the current shop settings or creates defaults if none exist.
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        $settings = ShopSiteSetting::first() ?? ShopSiteSetting::create([
            'is_shop_active'      => true,
            // English default like the web one (open finding #29) - the admin sets the real text.
            'maintenance_message' => 'We apologize, the shop is currently undergoing maintenance. Please try again later.',
        ]);

        return $this->respond($settings);
    }

    /**
     * Public, unauthenticated read of the shop's current availability status and message.
     * Used by the storefront (`shop/public/settings`) to render the maintenance page.
     *
     * @return JsonResponse
     */
    public function publicShow(): JsonResponse
    {
        $settings = ShopSiteSetting::first();

        return $this->respond([
            'is_shop_active'      => (bool) ($settings->is_shop_active ?? true),
            'maintenance_message' => $settings->maintenance_message ?? null,
        ]);
    }

    /**
     * Updates shop maintenance status, with mandatory password confirmation for security.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'confirm_password'    => 'required|string',
            'is_shop_active'      => 'sometimes|boolean',
            'maintenance_message' => 'sometimes|nullable|string|max:500',
        ]);

        // Route is behind auth:sanctum + permission - a user is always present.
        $auth = $request->user();

        // Security check: Verify password against database hash
        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            $this->logAction(
                $request,
                ShopLog::class,
                'unauthorized_maintenance_toggle_attempt',
                'Shop',
                "⚠️ UNAUTHORIZED attempt to toggle shop maintenance status by {$auth->user_email}. Incorrect password provided.",
                null,
                'ShopSiteSetting'
            );

            return response()->json(['message' => 'Invalid confirmation password.'], 403);
        }

        $settings = ShopSiteSetting::first() ?? new ShopSiteSetting();

        if (array_key_exists('is_shop_active', $validated)) {
            $settings->is_shop_active = $validated['is_shop_active'];
        }
        if (array_key_exists('maintenance_message', $validated)) {
            $settings->maintenance_message = $validated['maintenance_message'];
        }

        $settings->save();
        Cache::forget(self::CACHE_KEY);

        if (array_key_exists('is_shop_active', $validated)) {
            $statusText = $validated['is_shop_active'] ? 'ENABLED (Operational)' : 'DISABLED (Maintenance)';
            $this->logAction(
                $request,
                ShopLog::class,
                'maintenance_status_changed',
                'Shop',
                "User {$auth->user_email} changed e-shop status - {$statusText}.",
                $settings->id,
                'ShopSiteSetting'
            );
        }

        return $this->respond($settings);
    }

    /**
     * @description Editable texts of the order confirmation e-mail - subject / title / intro /
     *   outro (`{ lang: text }`) and the labels (`{ lang: { key: text } }`).
     * @return JsonResponse { data: { order_email_*_i18n } }
     */
    public function showOrderEmailTemplate(): JsonResponse
    {
        return $this->respond($this->orderTemplate(ShopSiteSetting::first()));
    }

    /**
     * @description Saves the texts of the order confirmation e-mail (all languages at once; no
     *   password re-confirmation - only the permission of the route, editing a text is not
     *   sensitive). Only the languages of the e-shop and the known labels are kept; texts are
     *   plain text (tags removed, line breaks kept in intro / outro / withdrawal_info), empty
     *   texts are dropped (the e-mail then uses the Czech one / the default).
     * @param Request $request { order_email_*_i18n }.
     * @return JsonResponse { data: { order_email_*_i18n } }
     */
    public function updateOrderEmailTemplate(Request $request): JsonResponse
    {
        $request->validate(array_merge(
            array_fill_keys(ShopOrderEmailTemplate::FIELDS, 'sometimes|nullable|array|max:' . I18nText::MAX_LANGUAGES),
            ['order_email_labels_i18n.*' => 'nullable|array|max:' . count(ShopOrderEmailTemplate::DEFAULTS)],
        ));

        $languages = TranslationController::languageCodes('shop') ?: ['cz'];
        $settings = ShopSiteSetting::first() ?? ShopSiteSetting::create(['is_shop_active' => true]);

        foreach (self::TEMPLATE_LIMITS as $field => $limit) {
            $key = "order_email_{$field}_i18n";
            if ($request->has($key)) {
                $settings->{$key} = I18nText::clean($request->input($key), $limit, in_array($field, ['intro', 'outro'], true), $languages);
            }
        }
        if ($request->has('order_email_labels_i18n')) {
            $labels = [];
            foreach ((array) $request->input('order_email_labels_i18n', []) as $lang => $texts) {
                if (!is_string($lang) || !in_array(strtolower($lang), $languages, true) || !is_array($texts)) {
                    continue;
                }
                foreach (array_keys(ShopOrderEmailTemplate::DEFAULTS) as $label) {
                    if (in_array($label, ['subject', 'title', 'intro', 'outro'], true)) {
                        continue;
                    }
                    $withdrawal = $label === 'withdrawal_info';
                    // One text through the same clean-up as the texts per language (key = the language).
                    $clean = I18nText::clean([$lang => $texts[$label] ?? null], $withdrawal ? self::WITHDRAWAL_LIMIT : self::LABEL_LIMIT, $withdrawal);
                    if (($clean[strtolower($lang)] ?? '') !== '') {
                        $labels[strtolower($lang)][$label] = $clean[strtolower($lang)];
                    }
                }
            }
            $settings->order_email_labels_i18n = $labels;
        }
        $settings->save();

        $this->logAction($request, ShopLog::class, 'update', 'Shop', 'Updated the order confirmation e-mail template.', $settings->id, 'ShopSiteSetting');

        return $this->respond($this->orderTemplate($settings));
    }

    /**
     * @description The template fields of the settings (empty objects when not set yet).
     * @param ShopSiteSetting|null $settings
     * @return array<string, object>
     */
    private function orderTemplate(?ShopSiteSetting $settings): array
    {
        $template = [];
        foreach (ShopOrderEmailTemplate::FIELDS as $field) {
            $template[$field] = (object) ($settings?->{$field} ?? []);
        }

        return $template;
    }
}
