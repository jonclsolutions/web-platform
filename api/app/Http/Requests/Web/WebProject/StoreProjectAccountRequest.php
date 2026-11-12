<?php
/**
 * @file StoreProjectAccountRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreProjectAccountRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description New client account of a project portal (administration). The login name is
 *   unique within the project (lower case letters, digits, . _ -); without a password the API
 *   generates one (`with_password` false = no password - then an invitation e-mail is needed,
 *   `send_invitation`, which needs an e-mail). The e-mail and its language are only prefilled for the client - which
 *   notifications it gets, the client decides itself in the portal (all off by default).
 * @dependencies WebProjectAccountController::store(), App\Models\Web\WebProjectAccount
 */

namespace App\Http\Requests\Web\WebProject;

use App\Models\Web\WebProjectAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreProjectAccountRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description The login name is compared in lower case (as stored).
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('username'))) {
            $this->merge(['username' => Str::lower(trim($this->input('username')))]);
        }
    }

    /**
     * @description Account fields; the password policy: at least 10 characters with letters and digits.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'username'     => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-z0-9._-]+$/',
                Rule::unique('web_project_accounts', 'username')->where('project_id', (int) $this->route('projectId'))],
            'display_name' => ['required', 'string', 'max:120'],
            'email'        => ['nullable', 'email', 'max:255', 'required_if_accepted:send_invitation'],
            'language'     => ['sometimes', Rule::in(WebProjectAccount::LANGUAGES)],
            'password'     => ['nullable', 'string', 'max:255', Password::min(10)->letters()->numbers()],
            // Access: a password (typed in above, or generated) and / or an invitation e-mail.
            'with_password'   => ['sometimes', 'boolean'],
            'send_invitation' => ['sometimes', 'boolean'],
        ];
    }
}
