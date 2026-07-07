<?php
/**
 * @file UpdateUserRequest.php
 * @path app/Http/Requests/User/UpdateUserRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating existing system users, ensuring integrity of email uniqueness during modification.
 */

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Core\CoreRole;

/**
 * @description Handles request validation for existing user profile updates.
 * @note Supports partial updates using 'sometimes' rules and ignores current user ID during unique email validation.
 */
class UpdateUserRequest extends FormRequest
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
        $userId = $this->route('id') ?? $this->route('user');
        $userId = is_object($userId) ? $userId->id : $userId;

        return [
            'user_email' => [
                'sometimes', 'required', 'email', 'max:255',
                Rule::unique('users', 'user_email')->ignore($userId),
            ],
            'full_name'           => ['sometimes', 'required', 'string', 'max:255'],
            'contact_email'       => ['nullable', 'email', 'max:255'],
            'user_password_hash'  => ['nullable', 'string', 'min:8'],
            'role_id'             => ['sometimes', 'required', 'integer', Rule::exists(CoreRole::class, 'id')],
            'phone_number'        => ['nullable', 'string', 'max:20'],
            'birth_date'          => ['nullable', 'date'],
            'personal_id_num'     => ['nullable', 'string', 'max:20'],
            'address'             => ['nullable', 'string'],
            'bank_account'        => ['nullable', 'string', 'max:50'],
            'commission_rate'     => ['nullable', 'numeric', 'min:0', 'max:100'],
            'has_tax_declaration' => ['boolean'],
            'internal_note'       => ['nullable', 'string'],
            'health_insurance'    => ['nullable', 'string', 'max:10'],
            'dpp_hours_spent'     => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'user_email.required'        => 'Přihlašovací e-mail je povinný.',
            'user_email.email'           => 'Zadejte platnou e-mailovou adresu pro přihlášení.',
            'user_email.unique'          => 'Tento přihlašovací e-mail je již obsazen.',
            'full_name.required'         => 'Jméno je povinné.',
            'contact_email.email'        => 'Neplatný formát kontaktního e-mailu.',
            'user_password_hash.min'     => 'Minimálně 8 znaků.',
            'role_id.required'           => 'Vyberte roli uživatele.',
            'role_id.exists'             => 'Vybraná role neexistuje.',
            'commission_rate.min'        => 'Provize nemůže být záporná.',
            'commission_rate.max'        => 'Provize může být maximálně 100 %.',
        ];
    }
}