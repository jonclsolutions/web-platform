<?php
/**
 * @file UpdateWebJobApplicationRequest.php
 * @path app/Http/Requests/Web/WebJobApplication/UpdateWebJobApplicationRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for updating existing job application records, including status changes and notes.
 */

namespace App\Http\Requests\Web\WebJobApplication;

use Illuminate\Foundation\Http\FormRequest;

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
        $safeExtensions = ['pdf', 'doc', 'docx', 'odt', 'jpg', 'jpeg', 'png', 'zip', 'rar'];

        return [
            'state'         => 'sometimes|required|string|max:50',
            'internal_note' => 'nullable|string',
            'first_name'    => 'sometimes|required|string|max:100',
            'last_name'     => 'sometimes|required|string|max:100',
            'email'         => 'sometimes|required|email|max:150',
            'phone'         => 'nullable|string|max:30',
            'position_name' => 'sometimes|required|string|max:150',
            'message'       => 'nullable|string',
            'cv_file'       => [
                'nullable', 
                'file', 
                'mimes:' . implode(',', $safeExtensions), 
                'max:20480'
            ],
        ];
    }
}