<?php
/**
 * @file UpdateProjectAccountRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/UpdateProjectAccountRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Change of a client account (administration, partial): login name, display name,
 *   e-mail, language. The notifications are the client's choice (portal) - the administration
 *   cannot turn them on; changing / removing the e-mail turns them off. The password changes only by a reset
 *   (ProjectAccountController::resetPassword()).
 * @dependencies ProjectAccountController::update(), App\Apps\ProjectPortal\Models\ProjectAccount
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use App\Apps\ProjectPortal\Models\ProjectAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateProjectAccountRequest extends FormRequest
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
     * @description Account fields.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'username'     => ['sometimes', 'required', 'string', 'min:3', 'max:64', 'regex:/^[a-z0-9._-]+$/',
                Rule::unique('web_project_accounts', 'username')
                    ->where('project_id', (int) $this->route('projectId'))
                    ->ignore((int) $this->route('accountId'))],
            'display_name' => ['sometimes', 'required', 'string', 'max:120'],
            'email'        => ['sometimes', 'nullable', 'email', 'max:255'],
            'language'     => ['sometimes', Rule::in(ProjectAccount::LANGUAGES)],
        ];
    }
}
