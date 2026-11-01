<?php
/**
 * @file UpdateCoreSecuritySettingRequest.php
 * @path app/Http/Requests/Core/CoreSecuritySetting/UpdateCoreSecuritySettingRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates the retention of the security logs: 7-365 days - shorter would delete
 * the evidence before an attack is analysed, longer conflicts with GDPR storage limitation.
 */

namespace App\Http\Requests\Core\CoreSecuritySetting;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreSecuritySettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorization: middleware 'permission:core-security-update'.
    }

    public function rules(): array
    {
        return [
            'retention_days' => ['required', 'integer', 'min:7', 'max:365'],
        ];
    }
}