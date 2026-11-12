<?php
/**
 * @file StoreWebProjectRequest.php
 * @path app/Http/Requests/Web/WebProject/StoreWebProjectRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation for creating a project - either standalone (no lead_id/
 * order_id) or from an existing sales order, both producing an identical row.
 */

namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\Web\WebProject;

class StoreWebProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'lead_id'                    => ['nullable', 'integer', 'exists:web_sales_leads,id'],
            'order_id'                   => ['nullable', 'integer', 'exists:web_sales_orders,id', 'unique:web_projects,order_id'],
            'name'                       => ['required', 'string', 'max:255'],
            'description'                => ['nullable', 'string'],
            'platform'                   => ['nullable', 'string', 'max:100', 'in:web,mobile,desktop,ai,other'],
            'project_lead'               => ['nullable', 'string', 'max:255'],
            'contact_phone'              => ['nullable', 'string', 'max:255'],
            'contact_email'              => ['nullable', 'email', 'max:255'],
            'technologies'               => ['nullable', 'string'],
            'estimated_completion_from'  => ['nullable', 'date'],
            'estimated_completion_to'    => ['nullable', 'date', 'after_or_equal:estimated_completion_from'],
            'visibility'                 => ['required', 'in:public,private'],
            'status'                     => ['nullable', 'in:' . implode(',', WebProject::STATUSES)],
            // Responsible administrator - only someone who can answer the client (WebProject::assignableUsers()).
            'assignee_id'                => ['nullable', 'integer', Rule::in(WebProject::assignableUsers()->pluck('id')->all())],
        ];
    }
}