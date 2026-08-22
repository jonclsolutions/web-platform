<?php
/**
 * @file UpdateCoreSecuritySettingRequest.php
 * @path app/Http/Requests/Core/CoreSecuritySetting/UpdateCoreSecuritySettingRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validace retenční doby bezpečnostních logů. Rozsah 7-365 dní - příliš
 * krátká retence by smazala evidenci dřív, než se stihne vyhodnotit útok; příliš dlouhá
 * koliduje s GDPR zásadou minimalizace uchovávaných dat.
 */

namespace App\Http\Requests\Core\CoreSecuritySetting;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreSecuritySettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // řešeno middlewarem 'permission:core-security-update'
    }

    public function rules(): array
    {
        return [
            'retention_days' => ['required', 'integer', 'min:7', 'max:365'],
        ];
    }
}