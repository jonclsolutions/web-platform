<?php
/**
 * @file UpdateWebProjectRequest.php
 * @path app/Http/Requests/Web/WebProject/UpdateWebProjectRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Same field set as Store, but nothing is required (partial update). The access
 * token never changes here; the client passwords belong to the client accounts
 * (WebProjectAccountController).
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
            'lead_id'                    => ['nullable', 'integer', 'exists:web_sales_leads,id'],
            'order_id'                   => ['nullable', 'integer', 'exists:web_sales_orders,id', Rule::unique('web_projects', 'order_id')->ignore($this->route('id'))],
            'name'                       => ['sometimes', 'required', 'string', 'max:255'],
            'description'                => ['nullable', 'string'],
            'platform'                   => ['nullable', 'string', 'max:100', 'in:web,mobile,desktop,ai,other'],
            'project_lead'               => ['nullable', 'string', 'max:255'],
            'contact_phone'              => ['nullable', 'string', 'max:255'],
            'contact_email'              => ['nullable', 'email', 'max:255'],
            'technologies'               => ['nullable', 'string'],
            'estimated_completion_from'  => ['nullable', 'date'],
            'estimated_completion_to'    => ['nullable', 'date', 'after_or_equal:estimated_completion_from'],
            'visibility'                 => ['sometimes', 'required', 'in:public,private'],
            'status'                     => ['sometimes', 'in:' . implode(',', WebProject::STATUSES)],
            // Responsible administrator - only someone who can answer the client (WebProject::assignableUsers()).
            'assignee_id'                => ['nullable', 'integer', Rule::in(WebProject::assignableUsers()->pluck('id')->all())],
        ];
    }
}