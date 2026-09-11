<?php
/**
 * @file UpdateWebProjectRequest.php
 * @path app/Http/Requests/Web/WebProject/UpdateWebProjectRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Same field set as Store, but nothing is required (partial update) -
 * `access_token`/`access_password_hash`/`visibility` (via update()) can be changed
 * here; the actual PASSWORD VALUE can only change through
 * WebProjectController::regeneratePassword(), never through this generic update.
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Web\WebProject;

class UpdateWebProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'lead_id'        => ['nullable', 'integer', 'exists:web_sales_leads,id'],
            'order_id'       => ['nullable', 'integer', 'exists:web_sales_orders,id', Rule::unique('web_projects', 'order_id')->ignore($this->route('id'))],
            'name'           => ['sometimes', 'required', 'string', 'max:255'],
            'description'    => ['nullable', 'string'],
            'platform'       => ['nullable', 'string', 'max:100', 'in:web,mobile,desktop,ai,other'],
            'project_lead'   => ['nullable', 'string', 'max:255'],
            'contact_phone'  => ['nullable', 'string', 'max:255'],
            'contact_email'  => ['nullable', 'email', 'max:255'],
            'technologies'   => ['nullable', 'string'],
            'visibility'     => ['sometimes', 'required', 'in:public,private'],
            'status'         => ['sometimes', 'in:' . implode(',', WebProject::STATUSES)],
        ];
    }
}