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
 * escaped JSON string instead of a usable object, and reads returned a mangled string
 * rather than the actual payload. Fix: pass a plain PHP array and let the model cast
 * handle serialization exactly once. Also strips common sensitive keys (passwords, tokens)
 * before logging, since `$request->all()` on any auth/user-management endpoint would
 * otherwise write plaintext credentials into the audit trail - a GDPR/security issue in
 * its own right, independent of the encoding bug.
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
     * @note Never throws - a failure here must not mask or interrupt the original
     * controller action. `context_data` is passed as a plain array - the model's
     * `'array'` cast performs the JSON encoding exactly once on write (see
     * @refactor-note above for why manually pre-encoding it here was a bug). Payload size
     * is bounded by capping the array to `MAX_CONTEXT_BYTES` worth of encoded JSON rather
     * than by truncating an already-encoded string, so the stored value stays valid JSON.
     */
    protected function logAction(
        Request $request,
        string $logModel,
        string $eventType,
        string $module,
        string $description,
        ?int $affectedId = null,
        ?string $affectedType = null
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
                'context_data'         => $this->safeContextData($request),
                'user_id_plain'        => (string)($user?->id ?? '0'),
                'user_plain'           => $user?->user_email ?? 'system',
            ]);
        } catch (\Exception $e) {
            Log::error("Log error ({$logModel}): " . $e->getMessage());
        }
    }

    /**
     * @description Builds a safe-to-store payload array from the request: strips
     * sensitive fields, then caps overall size so an oversized request body can never
     * cause the log write itself to fail on the `text` column limit.
     * @param Request $request
     * @return array
     */
    private function safeContextData(Request $request): array
    {
        $data = $request->except(self::SENSITIVE_KEYS);

        $encoded = json_encode($data, JSON_UNESCAPED_UNICODE);
        if ($encoded !== false && strlen($encoded) > 60000) {
            return ['_truncated' => true, 'note' => 'Payload exceeded 60000 bytes and was omitted.'];
        }

        return $data;
    }
}