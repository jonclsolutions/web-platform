<?php
/**
 * @file UpdateCoreSecurityEventRequest.php
 * @path app/Http/Requests/Core/CoreSecurityEvent/UpdateCoreSecurityEventRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates the triage of a security event - only the state and a note, never the
 * diagnostic data (written only by CoreSecurityEvent::record()).
 */

namespace App\Http\Requests\Core\CoreSecurityEvent;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreSecurityEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization: middleware 'permission:core-security-update' of the route.
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