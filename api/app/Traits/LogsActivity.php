<?php
/**
 * @file LogsActivity.php
 * @path app/Traits/LogsActivity.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared audit-logging helper used by Core/Web/Shop controllers. Writes to
 * whichever log model is passed in (CoreLog::class, WebLog::class, ShopLog::class - all
 * three share an identical column structure and an `'array'` cast on `context_data` by
 * design). Centralizes truncation safety so an oversized description/context_data can
 * never itself throw and mask the original error.
 *
 * @refactor-note (2026-08) Fixed a double-JSON-encoding bug: the original version called
 * `json_encode()` on `context_data` before passing it to `create()`, but the log models'
 * `'array'` cast ALSO json_encodes on write - stacking both meant the DB ended up with an
 * escaped JSON string instead of a usable object. Fix: pass a plain PHP array and let the
 * model cast handle serialization exactly once. Also strips common sensitive keys
 * (passwords, tokens) before logging.
 *
 * @refactor-note (2026-08-7) Two fixes found while auditing controllers still on the old
 * local logAction() pattern (AuthController/TranslationController/UserController):
 * 1) SENSITIVE_KEYS was missing `old_password`, `new_password`, `new_password_confirmation`.
 *    UserController::changePassword() sends exactly these field names - migrating it to
 *    this trait without adding them here would have logged plaintext passwords into
 *    `context_data`. Added.
 * 2) Added an optional 8th parameter `$extraExcludedKeys` - SiteConfigurationController
 *    already relied on this call shape (`logAction(..., ['logo_file'])`) to keep binary
 *    file uploads out of `context_data`; the trait signature didn't actually support it
 *    yet, which would have caused an ArgumentCountError. Any caller passing an uploaded
 *    file field (logo_file, icon_file, attachment, cv_file, ...) should use this instead
 *    of relying on the global SENSITIVE_KEYS list, since those are per-endpoint field
 *    names, not universally sensitive data.
 */

namespace App\Traits;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

trait LogsActivity
{
    /**
     * @description Keys stripped from the logged payload regardless of endpoint - never
     * write credentials or tokens into an audit trail, even accidentally.
     */
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'user_password_hash',
        'user_password_salt',
        'token',
        'refreshToken',
        'refresh_token',
        'current_password',
        'old_password',
        'new_password',
        'new_password_confirmation',
    ];

    /**
     * @description Logs an administrative action to the given audit-log model.
     * @param Request $request Current request instance (source of IP/user/payload).
     * @param string $logModel Fully-qualified log model class, e.g. CoreLog::class.
     * @param string $eventType Action type (create, update, delete, error, etc.).
     * @param string $module Domain module context (e.g. "WebNews", "CoreRole").
     * @param string $description Human-readable audit message.
     * @param int|null $affectedId Entity identifier.
     * @param string|null $affectedType Entity class/type name.
     * @param array $extraExcludedKeys Additional request keys to strip from context_data
     *   for this specific call only (e.g. uploaded file fields like 'logo_file') - on top
     *   of the global SENSITIVE_KEYS list.
     * @note Never throws - a failure here must not mask or interrupt the original
     * controller action.
     */
    protected function logAction(
        Request $request,
        string $logModel,
        string $eventType,
        string $module,
        string $description,
        ?int $affectedId = null,
        ?string $affectedType = null,
        array $extraExcludedKeys = []
    ): void {
        try {
            $user = $request->user();

            $logModel::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => Str::limit($description, 990, '...'),
                'affected_entity_type' => $affectedType,
                'affected_entity_id'   => $affectedId,
                'user_id'              => $user?->id,
                'context_data'         => $this->safeContextData($request, $extraExcludedKeys),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system',
            ]);
        } catch (\Exception $e) {
            Log::error("Log error ({$logModel}): " . $e->getMessage());
        }
    }

    /**
     * @description Builds a safe-to-store payload array from the request: strips
     * globally sensitive fields plus any call-specific extra fields, then caps overall
     * size so an oversized request body can never cause the log write itself to fail on
     * the `text` column limit.
     * @param Request $request
     * @param array $extraExcludedKeys
     * @return array
     */
    private function safeContextData(Request $request, array $extraExcludedKeys = []): array
    {
        $excluded = array_merge(self::SENSITIVE_KEYS, $extraExcludedKeys);
        $data = $request->except($excluded);

        $encoded = json_encode($data, JSON_UNESCAPED_UNICODE);
        if ($encoded !== false && strlen($encoded) > 60000) {
            return ['_truncated' => true, 'note' => 'Payload exceeded 60000 bytes and was omitted.'];
        }

        return $data;
    }
}