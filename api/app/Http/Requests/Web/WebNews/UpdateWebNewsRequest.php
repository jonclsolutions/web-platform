<?php
/**
 * @file UpdateWebNewsRequest.php
 * @path app/Http/Requests/Web/WebNews/UpdateWebNewsRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing web news articles.
 */

namespace App\Http\Requests\Web\WebNews;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for updating existing news content.
 */
class UpdateWebNewsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'title'    => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
            'message'  => ['sometimes', 'required', 'string', 'max:10000'],
            'author'   => ['sometimes', 'required', 'string', 'max:255'],
            'thema'    => ['sometimes', 'required', 'string', 'max:255', 'in:milestone,update,info,feature,warning,error,maintenance,event'],
            'bullet_1' => ['nullable', 'string', 'max:255'],
            'bullet_2' => ['nullable', 'string', 'max:255'],
            'bullet_3' => ['nullable', 'string', 'max:255'],
            'bullet_4' => ['nullable', 'string', 'max:255'],
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
            'title.required'   => 'The news title is required.',
            'title.min'        => 'The title must be between 3 and 255 characters.',
            'message.required' => 'The message content cannot be empty.',
            'message.max'      => 'The message content may not be greater than 10,000 characters.',
            'author.required'  => 'The author must be specified.',
            'thema.required'   => 'The theme is required.',
            'thema.in'         => 'The selected theme is invalid.',
        ];
    }
}