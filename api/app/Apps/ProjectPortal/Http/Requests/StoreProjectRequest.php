<?php
/**
 * @file StoreProjectRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/StoreProjectRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation for creating a project - either standalone (no lead_id/
 * order_id) or from an existing order, both producing an identical row (origin rules:
 * Project::originRules()).
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Apps\ProjectPortal\Models\Project;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            ...Project::originRules(),
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
            'status'                     => ['nullable', 'in:' . implode(',', Project::STATUSES)],
            // Responsible administrator - only someone who can answer the client (Project::assignableUsers()).
            'assignee_id'                => ['nullable', 'integer', Rule::in(Project::assignableUsers()->pluck('id')->all())],
            // Optional template whose checkpoints the new project gets (due dates from today).
            'template_id' => ['nullable', 'integer', 'exists:web_project_templates,id'],
        ];
    }
}