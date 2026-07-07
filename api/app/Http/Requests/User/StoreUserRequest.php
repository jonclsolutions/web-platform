<?php
/**
 * @file StoreUserRequest.php
 * @path app/Http/Requests/User/StoreUserRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new system users, including HR-specific fields like commissions and tax declarations.
 */

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Core\CoreRole;

/**
 * @description Handles request validation for new user registration and account creation.
 * @note Implements automatic default value injection for commission rates and DPP hours.
 */
class StoreUserRequest extends FormRequest
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
            'user_email'          => ['required', 'email', 'max:255', 'unique:users,user_email'],
            'full_name'           => ['required', 'string', 'max:255'],
            'contact_email'       => ['nullable', 'email', 'max:255'],
            'user_password_hash'  => ['required', 'string', 'min:8'],
            'role_id'             => ['required', 'numeric', Rule::exists(CoreRole::class, 'id')], 
            'phone_number'        => ['nullable', 'string', 'max:20'],
            'birth_date'          => ['nullable', 'date'],
            'personal_id_num'     => ['nullable', 'string', 'max:20'],
            'address'             => ['nullable', 'string'],
            'bank_account'        => ['nullable', 'string', 'max:50'],
            'commission_rate'     => ['required', 'numeric', 'min:0', 'max:100'],
            'has_tax_declaration' => ['nullable', 'boolean'],
            'internal_note'       => ['nullable', 'string'],
            'health_insurance'    => ['nullable', 'string', 'max:10'],
            'dpp_hours_spent'     => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Prepare data for validation, setting default values for business logic fields.
     *
     * @return void
     */
    protected function prepareForValidation()
    {
        $this->merge([
            'has_tax_declaration' => filter_var($this->has_tax_declaration, FILTER_VALIDATE_BOOLEAN),
            'commission_rate'     => $this->filled('commission_rate') ? $this->commission_rate : 10,
            'dpp_hours_spent'     => $this->filled('dpp_hours_spent') ? $this->dpp_hours_spent : 0,
        ]);
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'user_email.required'         => 'Přihlašovací e-mail je povinný.',
            'user_email.email'            => 'Zadejte platnou e-mailovou adresu pro přihlášení.',
            'user_email.max'              => 'E-mail může obsahovat maximálně 255 znaků.',
            'user_email.unique'           => 'Tento přihlašovací e-mail je již obsazen.',
            'full_name.required'          => 'Jméno je povinné.',
            'contact_email.email'         => 'Neplatný formát kontaktního e-mailu.',
            'user_password_hash.required' => 'Heslo je povinné.',
            'user_password_hash.min'      => 'Minimálně 8 znaků.',
            'role_id.required'            => 'Vyberte roli uživatele.',
            'role_id.exists'              => 'Vybraná role neexistuje.',
            'commission_rate.required'    => 'Sazba provize je povinná.',
            'commission_rate.min'         => 'Provize nemůže být záporná.',
            'commission_rate.max'         => 'Provize může být maximálně 100 %.',
        ];
    }
}