<?php
/**
 * @file UpdateWebJobApplicationRequest.php
 * @path app/Apps/Web/Http/Requests/WebJobApplication/UpdateWebJobApplicationRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for updating existing job application records, including status changes and notes.
 */

namespace App\Apps\Web\Http\Requests\WebJobApplication;

use Illuminate\Foundation\Http\FormRequest;
use App\Apps\Web\WebApp;
use App\Support\Uploads\AttachmentPolicy;

/**
 * @description Handles request validation for updating existing job applications.
 */
class UpdateWebJobApplicationRequest extends FormRequest
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
            'state'         => 'sometimes|required|string|max:50|in:new,interview,selected,rejected,pool',
            'internal_note' => 'nullable|string',
            'first_name'    => 'sometimes|required|string|max:100',
            'last_name'     => 'sometimes|required|string|max:100',
            'email'         => 'sometimes|required|email|max:150',
            'phone'         => 'nullable|string|max:30',
            'position_name' => 'sometimes|required|string|max:150',
            'message'       => 'nullable|string',
            'cv_file'       => ['nullable', ...AttachmentPolicy::fileRules(WebApp::UPLOAD_JOB_APPLICATION)],
        ];
    }
}