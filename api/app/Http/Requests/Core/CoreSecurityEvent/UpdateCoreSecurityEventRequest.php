<?php
/**
 * @file UpdateCoreSecurityEventRequest.php
 * @path app/Http/Requests/Core/CoreSecurityEvent/UpdateCoreSecurityEventRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validace triage akce nad bezpečnostním eventem - jen stav a poznámka,
 * nikdy samotná diagnostická data (ta zapisuje výhradně CoreSecurityEvent::record()).
 */

namespace App\Http\Requests\Core\CoreSecurityEvent;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreSecurityEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Autorizace řešena middlewarem 'permission:core-security-update' na route úrovni.
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'required', 'string', 'in:new,reviewed,false_positive,confirmed_attack'],
            'notes'  => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}