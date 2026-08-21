<?php
/**
 * @file WebSiteSettingController.php
 * @path app/Http/Controllers/Api/Web/WebSiteSettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages public-web maintenance mode - toggling web availability and the
 * visitor-facing maintenance message, with mandatory password re-confirmation for the
 * write action. Také spravuje editovatelný obsah potvrzovacího e-mailu
 * WebRawRequestCommission (nadpis/úvod/závěr, per jazyk) - viz refactor-note
 * (2026-08-19) níže.
 *
 * @refactor-note (2026-08-15) Replaces the web branch of `CoreSiteSettingController`
 * (now deleted, along with `App\Models\Core\CoreSiteSetting` and the `core_site_settings`
 * table). Web maintenance is now a Web-domain concern with its own table
 * (`web_site_settings`), model (`WebSiteSetting`), and permission-gated routes under
 * `/api/web/settings`. Mirrors `ShopSiteSettingController`, which underwent the same
 * extraction for shop maintenance earlier.
 * @note No `publicShow()` here - the unauthenticated public consumer for web status was
 * already `WebPublicController::getStatus()` (`GET /api/web/public/status`) before this
 * refactor and remains the single public entry point; no new public route was introduced.
 *
 * @refactor-note (2026-08-19) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
 * přidány `showRawRequestEmailTemplate()`/`updateRawRequestEmailTemplate()` - sdílí
 * stejný singleton `WebSiteSetting` řádek jako maintenance nastavení (je to pořád
 * Web-doménová konfigurace), ale ZÁMĚRNĚ BEZ `confirm_password` požadavku jako u
 * `update()` výše - editace textu potvrzovacího e-mailu není bezpečnostně citlivá
 * akce jako přepnutí dostupnosti celého webu. Gatováno permission middlewarem
 * `web-user-requests-update` na route úrovni (viz api.php) - stejné oprávnění, jaké
 * už řídí editaci jednotlivého požadavku na admin stránce "Požadavky na provize".
 */

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use App\Models\Web\WebSiteSetting;
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;

/**
 * @description Controller responsible for public-web-wide maintenance status settings
 * and the editable raw-request-commission confirmation email template.
 * @note Uses Cache invalidation (`site_setting_active_web`) so `CheckWebActive` middleware
 * and the public status endpoint react instantly to configuration changes.
 */
class WebSiteSettingController extends Controller
{
    use LogsActivity;

    /**
     * @description Cache key shared with `CheckWebActive` middleware and
     * `WebPublicController::getStatus()` - must stay in sync.
     */
    private const CACHE_KEY = 'site_setting_active_web';

    /**
     * Retrieves the current web settings or creates defaults if none exist.
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        $settings = WebSiteSetting::first() ?? WebSiteSetting::create([
            'is_web_active'           => true,
            'web_maintenance_message' => 'Omlouváme se, web je momentálně v údržbě.',
        ]);

        return response()->json($settings);
    }

    /**
     * Updates web maintenance status, with mandatory password confirmation for security.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'confirm_password'        => 'required|string',
            'is_web_active'           => 'sometimes|boolean',
            'web_maintenance_message' => 'sometimes|nullable|string|max:500',
        ]);

        $auth = $request->user() ?? auth('sanctum')->user();

        if (!$auth) {
            return response()->json(['message' => 'User is not authenticated.'], 401);
        }

        // Security check: Verify password against database hash
        if (!Hash::check($validated['confirm_password'], $auth->user_password_hash)) {
            $this->logAction(
                $request,
                WebLog::class,
                'unauthorized_maintenance_toggle_attempt',
                'Web',
                "⚠️ UNAUTHORIZED attempt to toggle web maintenance status by {$auth->user_email}. Incorrect password provided.",
                null,
                'WebSiteSetting'
            );

            return response()->json(['message' => 'Invalid confirmation password.'], 403);
        }

        $settings = WebSiteSetting::first() ?? new WebSiteSetting();

        if (array_key_exists('is_web_active', $validated)) {
            $settings->is_web_active = $validated['is_web_active'];
        }
        if (array_key_exists('web_maintenance_message', $validated)) {
            $settings->web_maintenance_message = $validated['web_maintenance_message'];
        }

        $settings->save();
        Cache::forget(self::CACHE_KEY);

        if (array_key_exists('is_web_active', $validated)) {
            $statusText = $validated['is_web_active'] ? 'ENABLED (Operational)' : 'DISABLED (Maintenance)';
            $this->logAction(
                $request,
                WebLog::class,
                'maintenance_status_changed',
                'Web',
                "User {$auth->user_email} changed web status - {$statusText}.",
                $settings->id,
                'WebSiteSetting'
            );
        }

        return response()->json([
            'success' => true,
            'data'    => $settings,
        ]);
    }

    /**
     * @description Vrátí jen editovatelná pole šablony potvrzovacího e-mailu
     * WebRawRequestCommission (nadpis/úvod/závěr, každé jako i18n objekt keyed
     * jazykovým kódem). Vrací PŘÍMO objekt (ne obalený v `{data: ...}`) - konzistentní
     * s tím, jak `DataHandler.get<T>()` na frontendu odpověď NEobaluje, na rozdíl od
     * `put()`.
     */
    public function showRawRequestEmailTemplate(): JsonResponse
    {
        $settings = WebSiteSetting::first() ?? WebSiteSetting::create([
            'is_web_active'           => true,
            'web_maintenance_message' => 'Omlouváme se, web je momentálně v údržbě.',
        ]);

        return response()->json([
            'raw_request_email_subject_i18n' => $settings->raw_request_email_subject_i18n,
            'raw_request_email_title_i18n'   => $settings->raw_request_email_title_i18n,
            'raw_request_email_intro_i18n'   => $settings->raw_request_email_intro_i18n,
            'raw_request_email_outro_i18n'   => $settings->raw_request_email_outro_i18n,
            'raw_request_email_labels_i18n'  => $settings->raw_request_email_labels_i18n,
        ]);
    }

    /**
     * @description Uloží editovatelnou šablonu potvrzovacího e-mailu
     * WebRawRequestCommission. ZÁMĚRNĚ BEZ `confirm_password` (viz refactor-note
     * v hlavičce souboru) - jen permission middleware na route úrovni.
     */
    public function updateRawRequestEmailTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'raw_request_email_subject_i18n' => 'sometimes|nullable|array',
            'raw_request_email_title_i18n'  => 'sometimes|nullable|array',
            'raw_request_email_intro_i18n'  => 'sometimes|nullable|array',
            'raw_request_email_outro_i18n'  => 'sometimes|nullable|array',
            'raw_request_email_labels_i18n' => 'sometimes|nullable|array',
        ]);

        $settings = WebSiteSetting::first() ?? new WebSiteSetting();
        $settings->fill($validated);
        $settings->save();

        $this->logAction(
            $request,
            WebLog::class,
            'update',
            'Web',
            'Upravena šablona potvrzovacího e-mailu (Požadavky na provize).',
            $settings->id,
            'WebSiteSetting'
        );

        return response()->json([
            'success' => true,
            'data'    => $settings,
        ]);
    }
}