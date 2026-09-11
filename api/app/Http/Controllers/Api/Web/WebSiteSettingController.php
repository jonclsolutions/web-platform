<?php
/**
 * @file WebSiteSettingController.php
 * @path app/Http/Controllers/Api/Web/WebSiteSettingController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages public-web maintenance mode - toggling web availability and the
 * visitor-facing maintenance message, with mandatory password re-confirmation for the
 * write action. Also manages the editable content of the WebRawRequestCommission
 * confirmation email (heading/intro/outro, per language) - see refactor-note
 * (2026-08-19) below.
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
 * @refactor-note (2026-08-19) BACKLOG "editable confirmation email content":
 * added `showRawRequestEmailTemplate()`/`updateRawRequestEmailTemplate()` - shares
 * the same singleton `WebSiteSetting` row as maintenance settings (it's still a
 * Web-domain configuration), but INTENTIONALLY WITHOUT the `confirm_password` requirement
 * like `update()` above - editing confirmation email text is not a security-sensitive
 * action like toggling the availability of the entire web. Gated by permission middleware
 * `web-user-requests-update` at route level (see api.php) - the same permission that
 * already controls editing an individual request on the admin page "Commission Requests".
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
            'web_maintenance_message' => 'We apologize, but the website is currently undergoing maintenance.',
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
     * @description Returns only the editable fields of the WebRawRequestCommission
     * confirmation email template (subject/title/intro/outro/labels, each as an i18n object keyed
     * by language code). Returns DIRECTLY the object (not wrapped in `{data: ...}`) - consistent
     * with how `DataHandler.get<T>()` on the frontend does NOT wrap the response, unlike
     * `put()`.
     */
    public function showRawRequestEmailTemplate(): JsonResponse
    {
        $settings = WebSiteSetting::first() ?? WebSiteSetting::create([
            'is_web_active'           => true,
            'web_maintenance_message' => 'We apologize, but the website is currently undergoing maintenance.',
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
     * @description Saves the editable WebRawRequestCommission confirmation email template.
     * INTENTIONALLY WITHOUT `confirm_password` (see refactor-note in file header) -
     * only permission middleware at route level.
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
            'Updated confirmation email template (Commission Requests).',
            $settings->id,
            'WebSiteSetting'
        );

        return response()->json([
            'success' => true,
            'data'    => $settings,
        ]);
    }
}