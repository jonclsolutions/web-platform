<?php
/**
 * @file ModelChanges.php
 * @path app/Support/Audit/ModelChanges.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Collects the data changes of the current request (or command) for the audit log:
 * every Eloquent model created / updated / deleted / restored is noted with its changed attributes
 * - an update as `{attribute: [old, new]}`. LogsActivity::logAction() takes the collected changes
 * (flush()) into `context_data.changes` of the log row it writes, so each log entry shows exactly
 * what changed in the database, not only what the browser sent.
 * @note Not collected: the audit log / security event models themselves, auth tokens, timestamps
 *   and hidden attributes (password hashes, 2FA secrets…), keys naming a secret. Personal data
 *   (`AUDIT_MASKED` of a model, plus the private keys of a log call) is noted as `[masked]` - the
 *   log shows THAT it changed, not the value, so an erased record leaves no copy. Values are cut
 *   to 500 characters, at most 100 changes are kept per log row (`_more` counts the rest).
 *   Registered as a scoped singleton (one per request / job) in AppServiceProvider.
 * @dependencies Eloquent model events.
 */

namespace App\Support\Audit;

use App\Models\AccountActivationToken;
use App\Models\Core\CoreLog;
use App\Support\Apps\AppRegistry;
use App\Models\Core\CoreSecurityEvent;
use App\Models\PasswordResetToken;
use App\Models\RefreshToken;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ModelChanges
{
    /** @description Changes kept per log row. */
    public const MAX_ENTRIES = 100;

    /** @description Longest stored value. */
    private const MAX_VALUE_LENGTH = 500;

    /** @description Attributes never stored (besides the model's hidden ones). */
    private const SKIPPED_ATTRIBUTES = ['created_at', 'updated_at'];

    /** @description Attribute names whose value is never stored. */
    private const SECRET_PATTERN = '/password|token|secret|two_factor|remember/i';

    /** @description Stored instead of a personal value. */
    public const MASK = '[masked]';

    /** @description Models whose changes are not collected (logs, auth tokens) - plus the audit logs of the applications (AppRegistry::logModels()). */
    private const SKIPPED_MODELS = [
        CoreLog::class,
        CoreSecurityEvent::class,
        RefreshToken::class,
        AccountActivationToken::class,
        PasswordResetToken::class,
        'Laravel\\Sanctum\\PersonalAccessToken',
    ];

    /** @var array<int, array<string, mixed>> Changes collected since the last flush(). */
    private array $entries = [];

    /** @var int Changes not kept because of MAX_ENTRIES. */
    private int $dropped = 0;

    /**
     * @description Notes one model event.
     * @param string $event created | updated | deleted | restored.
     * @param Model $model The model.
     * @return void
     */
    public function record(string $event, Model $model): void
    {
        if (in_array($model::class, self::SKIPPED_MODELS, true) || in_array($model::class, AppRegistry::logModels(), true)) {
            return;
        }

        $entry = ['model' => class_basename($model), 'id' => $model->getKey(), 'event' => $event];
        if ($event === 'updated') {
            $previous = $model->getPrevious();
            $changes = [];
            foreach ($model->getChanges() as $attribute => $value) {
                if ($this->skipped($model, $attribute)) {
                    continue;
                }
                $changes[$attribute] = $this->masked($model, $attribute)
                    ? [self::MASK, self::MASK]
                    : [$this->value($previous[$attribute] ?? null), $this->value($value)];
            }
            if ($changes === []) {
                return;
            }
            $entry['changes'] = $changes;
        } elseif ($event === 'created') {
            $values = [];
            foreach ($model->getAttributes() as $attribute => $value) {
                if (!$this->skipped($model, $attribute) && $value !== null) {
                    $values[$attribute] = $this->masked($model, $attribute) ? self::MASK : $this->value($value);
                }
            }
            $entry['values'] = $values;
        } elseif ($event === 'deleted' && method_exists($model, 'isForceDeleting')) {
            $entry['event'] = $model->isForceDeleting() ? 'force_deleted' : 'soft_deleted';
        }

        if (count($this->entries) >= self::MAX_ENTRIES) {
            $this->dropped++;
            return;
        }
        $this->entries[] = $entry;
    }

    /**
     * @description Returns the changes collected since the last call and starts again.
     * @param array<int, string> $maskedKeys Further attributes to mask (private keys of the log call).
     * @return array<int, array<string, mixed>> Entries (+ `['_more' => n]` when some were dropped).
     */
    public function flush(array $maskedKeys = []): array
    {
        $entries = $this->entries;
        if ($maskedKeys !== []) {
            foreach ($entries as &$entry) {
                foreach (['changes', 'values'] as $part) {
                    foreach (array_intersect(array_keys($entry[$part] ?? []), $maskedKeys) as $key) {
                        $entry[$part][$key] = $part === 'changes' ? [self::MASK, self::MASK] : self::MASK;
                    }
                }
            }
            unset($entry);
        }
        if ($this->dropped > 0) {
            $entries[] = ['_more' => $this->dropped];
        }
        $this->entries = [];
        $this->dropped = 0;

        return $entries;
    }

    /**
     * @description Is the attribute left out (timestamp, hidden, secret)?
     * @param Model $model The model.
     * @param string $attribute Attribute name.
     * @return bool
     */
    private function skipped(Model $model, string $attribute): bool
    {
        return in_array($attribute, self::SKIPPED_ATTRIBUTES, true)
            || in_array($attribute, $model->getHidden(), true)
            || preg_match(self::SECRET_PATTERN, $attribute) === 1;
    }

    /**
     * @description Is the attribute personal data of the model (AUDIT_MASKED)?
     * @param Model $model The model.
     * @param string $attribute Attribute name.
     * @return bool
     */
    private function masked(Model $model, string $attribute): bool
    {
        return defined($model::class . '::AUDIT_MASKED') && in_array($attribute, $model::AUDIT_MASKED, true);
    }

    /**
     * @description Storable form of a value: scalars as they are (strings cut), the rest as JSON.
     * @param mixed $value Raw attribute value.
     * @return mixed
     */
    private function value(mixed $value): mixed
    {
        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }
        if (!is_string($value)) {
            $value = $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i:s') : (string) json_encode($value, JSON_UNESCAPED_UNICODE);
        }

        return Str::limit($value, self::MAX_VALUE_LENGTH);
    }
}
