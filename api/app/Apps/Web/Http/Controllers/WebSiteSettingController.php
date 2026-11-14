<?php
/**
 * @file WebSiteSettingController.php
 * @path app/Apps/Web/Http/Controllers/WebSiteSettingController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manages public-web maintenance mode - toggling web availability and the
 * visitor-facing maintenance message, with mandatory password re-confirmation for the
 * write action. Also manages the editable content of the WebRawRequestCommission
 * confirmation email (heading/intro/outro, per language)
 * (2026-08-19) below.
 *
 * @note No `publicShow()` here - the unauthenticated public consumer for web status was
 * already `WebPublicController::getStatus()` (`GET /api/web/public/status`) before this
 * refactor and remains the single public entry point; no new public route was introduced.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebSiteSetting;
use App\Apps\Web\Models\WebLog;
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

        return $this->respond($settings);
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

        $auth = $request->user();

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

        return $this->respond($settings);
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

        return $this->respond([
            'raw_request_email_subject_i18n' => $settings->raw_request_email_subject_i18n,
            'raw_request_email_title_i18n'   => $settings->raw_request_email_title_i18n,
            'raw_request_email_intro_i18n'   => $settings->raw_request_email_intro_i18n,
            'raw_request_email_outro_i18n'   => $settings->raw_request_email_outro_i18n,
            'raw_request_email_labels_i18n'  => $settings->raw_request_email_labels_i18n,
        ]);
    }

    /**
     * @description Saves the editable WebRawRequestCommission confirmation email template.
     * INTENTIONALLY WITHOUT `confirm_password` -
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

        return $this->respond($settings);
    }
}
