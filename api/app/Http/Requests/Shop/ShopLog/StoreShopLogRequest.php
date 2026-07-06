<?php
/**
 * @file StoreShopLogRequest.php
 * @path app/Http/Requests/Shop/ShopLog/StoreShopLogRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new shop log entries.
 */

namespace App\Http\Requests\Shop\ShopLog;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for manual creation of audit log entries within the shop module.
 */
class StoreShopLogRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'origin'               => ['required', 'string', 'max:45'],
            'event_type'           => ['required', 'string', 'max:50'],
            'module'               => ['required', 'string', 'max:50'],
            'description'          => ['required', 'string', 'max:1000'],
            'affected_entity_type' => ['nullable', 'string', 'max:50'],
            'affected_entity_id'   => ['nullable', 'integer'],
            'user_id'              => ['nullable', 'integer', 'exists:users,id'],
            'user_id_plain'        => ['nullable', 'string', 'max:20'],
            'user_plain'           => ['nullable', 'string', 'max:150'],
            'context_data'         => ['nullable', 'json'],
        ];
    }
}