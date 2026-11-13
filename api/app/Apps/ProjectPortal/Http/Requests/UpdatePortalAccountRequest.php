<?php
/**
 * @file UpdatePortalAccountRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/UpdatePortalAccountRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings the client changes for its own account in the project portal ("My
 *   account"): its e-mail, the language of the e-mails and which notifications it wants (a new
 *   reply, a checkpoint status change, a checkpoint due date change). Everything else of the
 *   account (login name, name, password) only the administration changes. A notification turned
 *   on needs an e-mail - checked in ProjectPublicController::updateAccount() after the merge
 *   with the stored values.
 * @dependencies ProjectPublicController::updateAccount(), App\Apps\ProjectPortal\Models\ProjectAccount
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use App\Apps\ProjectPortal\Models\ProjectAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePortalAccountRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description E-mail is trimmed (an empty one = none).
     * @return void
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => trim($this->input('email')) ?: null]);
        }
    }

    /**
     * @description Fields of the client's own settings (partial).
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'email'    => ['sometimes', 'nullable', 'email', 'max:255'],
            'language' => ['sometimes', Rule::in(ProjectAccount::LANGUAGES)],
        ];
        foreach (ProjectAccount::NOTIFICATIONS as $column) {
            $rules[$column] = ['sometimes', 'boolean'];
        }

        return $rules;
    }
}
