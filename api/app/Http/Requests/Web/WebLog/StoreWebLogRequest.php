<?php
/**
 * @file StoreWebLogRequest.php
 * @path app/Http/Requests/Web/WebLog/StoreWebLogRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for recording system logs from web events.
 */

namespace App\Http\Requests\Web\WebLog;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for storing new system logs, tracking origin and affected entities.
 */
class StoreWebLogRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'origin'               => 'nullable|string|max:255',
            'event_type'           => 'required|string|max:50',
            'module'               => 'required|string|max:100',
            'description'          => 'nullable|string|max:1000',
            'affected_entity_type' => 'nullable|string|max:50',
            'affected_entity_id'   => 'nullable|integer',
            'context_data'         => 'nullable|string',
            'user_id_plain'        => 'nullable|string|max:255',
            'user_plain'           => 'nullable|string|max:255',
        ];
    }
}