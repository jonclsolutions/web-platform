<?php
/**
 * @file StoreUserRequest.php
 * @path app/Http/Requests/User/StoreUserRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new system users.
 *
 * @refactor-note (2026-08) Odstraněna validace legacy HR/osobních polí + `commission_rate`
 * / `has_tax_declaration` (viz User.php).
 *
 * @refactor-note (2026-08-2) `user_password_hash` sjednoceno na politiku hesla platnou
 * napříč aplikací (8-16 znaků, alespoň 1 písmeno, 1 číslice, 1 speciální znak) - viz
 * odpovídající frontend `password-policy.ts`. Dřív jen `min:8` bez horní hranice a bez
 * požadavků na složení hesla.
 *
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu": validace
 * hesla ÚPLNĚ ODSTRANĚNA - formulář na vytvoření účtu už heslo nesbírá. Účet vzniká s
 * `user_password_hash = null` (viz UserController::store()) a uživatel si heslo
 * nastaví sám přes aktivační e-mail (AccountActivationController::activate()), kde
 * platí STEJNÁ politika hesla, jen validovaná odděleně na tamním endpointu.
 */

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Core\CoreRole;

/**
 * @description Handles request validation for new user registration and account creation.
 * @note Implements automatic default value injection for DPP hours.
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
            'user_email'      => ['required', 'email', 'max:255', 'unique:users,user_email'],
            'full_name'       => ['required', 'string', 'max:255'],
            'role_id'         => ['required', 'numeric', Rule::exists(CoreRole::class, 'id')],
            'internal_note'   => ['nullable', 'string'],
            'dpp_hours_spent' => ['nullable', 'integer', 'min:0'],
            'enable_2fa'      => ['nullable', 'boolean'],
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
            'dpp_hours_spent' => $this->filled('dpp_hours_spent') ? $this->dpp_hours_spent : 0,
            'enable_2fa'      => filter_var($this->enable_2fa, FILTER_VALIDATE_BOOLEAN),
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
            'user_email.required' => 'Přihlašovací e-mail je povinný.',
            'user_email.email'    => 'Zadejte platnou e-mailovou adresu pro přihlášení.',
            'user_email.max'      => 'E-mail může obsahovat maximálně 255 znaků.',
            'user_email.unique'   => 'Tento přihlašovací e-mail je již obsazen.',
            'full_name.required'  => 'Jméno je povinné.',
            'role_id.required'    => 'Vyberte roli uživatele.',
            'role_id.exists'      => 'Vybraná role neexistuje.',
        ];
    }
}