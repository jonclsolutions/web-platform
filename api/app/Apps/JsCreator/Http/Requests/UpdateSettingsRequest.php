<?php
/**
 * @file UpdateSettingsRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateSettingsRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings of JS Creator: default quota of an account (MB, 1 MB … 100 GB).
 * @dependencies SettingsController::update()
 */

namespace App\Apps\JsCreator\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    /** @description Highest quota (MB) - 100 GB. */
    public const MAX_QUOTA_MB = 102400;

    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Whole number of MB within the range.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['default_quota_mb' => ['required', 'integer', 'min:1', 'max:' . self::MAX_QUOTA_MB]];
    }
}
