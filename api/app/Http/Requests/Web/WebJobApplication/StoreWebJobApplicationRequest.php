<?php
/**
 * @file StoreWebJobApplicationRequest.php
 * @path app/Http/Requests/Web/WebJobApplication/StoreWebJobApplicationRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for incoming job applications, including file type constraints for CVs.
 */

namespace App\Http\Requests\Web\WebJobApplication;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for new job applications from the web frontend.
 * @note Enforces security by restricting file types and setting a maximum file size for attachments.
 */
class StoreWebJobApplicationRequest extends FormRequest
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
        $safeExtensions = [
            'pdf', 'doc', 'docx', 'odt', 'pages', 'rtf', 'txt',
            'jpg', 'jpeg', 'png', 'heic', 'heif',
            'zip', 'rar', '7z'
        ];

        return [
            'first_name'    => 'required|string|max:100',
            'last_name'     => 'required|string|max:100',
            'email'         => 'required|email|max:150',
            'phone'         => 'nullable|string|max:30',
            'position_name' => 'required|string|max:150',
            'message'       => 'nullable|string',
            
            'cv_file'       => [
                'required',
                'file',
                'mimes:' . implode(',', $safeExtensions),
                'max:20480',
            ],
            'dataProcessingAgreement' => 'required|accepted',
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'cv_file.required' => 'Please upload your CV.',
            'cv_file.mimes'    => 'Allowed formats for the CV are PDF, Word, images, or archives.',
            'cv_file.max'      => 'The file must not be larger than 20 MB.',
        ];
    }
}