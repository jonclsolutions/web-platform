<?php
/**
 * @file UpdateCoreRetentionSettingRequest.php
 * @path app/Http/Requests/Core/CoreRetentionSetting/UpdateCoreRetentionSettingRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates the retention periods of the personal data: a list of
 * `{data_key, retention_days}` - the key one of CoreRetentionSetting::DEFAULTS, the period
 * MIN_DAYS-MAX_DAYS days or null (automatic deletion off).
 */

namespace App\Http\Requests\Core\CoreRetentionSetting;

use App\Models\Core\CoreRetentionSetting;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCoreRetentionSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization: middleware 'permission:core-legal-config-update'.
    }

    public function rules(): array
    {
        return [
            'settings'                  => ['required', 'array', 'min:1'],
            'settings.*.data_key'       => ['required', 'string', 'distinct', Rule::in(array_keys(CoreRetentionSetting::DEFAULTS))],
            'settings.*.retention_days' => ['present', 'nullable', 'integer', 'min:' . CoreRetentionSetting::MIN_DAYS, 'max:' . CoreRetentionSetting::MAX_DAYS],
        ];
    }
}
