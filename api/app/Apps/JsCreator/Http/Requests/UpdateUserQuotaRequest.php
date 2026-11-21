<?php
/**
 * @file UpdateUserQuotaRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateUserQuotaRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Individual quota of an account (MB); null = the default quota applies.
 * @dependencies UpdateSettingsRequest::MAX_QUOTA_MB, SettingsController::updateQuota()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserQuotaRequest extends FormRequest
{
    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Present; null or a whole number of MB within the range.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['quota_mb' => ['present', 'nullable', 'integer', 'min:1', 'max:' . UpdateSettingsRequest::MAX_QUOTA_MB]];
    }
}
