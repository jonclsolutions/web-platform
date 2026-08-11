<?php
/**
 * @file UpdateUserRequest.php
 * @path app/Http/Requests/User/UpdateUserRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating existing system users.
 *
 * @refactor-note (2026-08) Odstraněna validace legacy HR/osobních polí + `commission_rate`
 * / `has_tax_declaration` (viz User.php).
 *
 * @refactor-note (2026-08-2) `user_password_hash` sjednoceno na politiku hesla platnou
 * napříč aplikací (8-16 znaků, alespoň 1 písmeno, 1 číslice, 1 speciální znak) - viz
 * odpovídající frontend `password-policy.ts`. Zůstává `nullable` (update hesla je
 * volitelný), ale pokud se pošle, musí splnit stejná pravidla jako všude jinde.
 */

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
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
            'user_password_hash'  => [
                'nullable', 'string', 'max:16',
                Password::min(8)->letters()->numbers()->symbols(),
            ],
            'role_id'             => ['sometimes', 'required', 'integer', Rule::exists(CoreRole::class, 'id')],
            'internal_note'       => ['nullable', 'string'],
            'dpp_hours_spent'     => ['nullable', 'integer', 'min:0'],
            'enable_2fa'          => ['nullable', 'boolean'],
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
            'user_password_hash.max'     => 'Heslo může mít maximálně 16 znaků.',
            'role_id.required'           => 'Vyberte roli uživatele.',
            'role_id.exists'             => 'Vybraná role neexistuje.',
        ];
    }
}