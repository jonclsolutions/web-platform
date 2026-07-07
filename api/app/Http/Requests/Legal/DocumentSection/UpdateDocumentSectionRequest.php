<?php
/**
 * @file UpdateDocumentSectionRequest.php
 * @path app/Http/Requests/Legal/DocumentSection/UpdateDocumentSectionRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for updating existing legal document sections.
 */

namespace App\Http\Requests\Legal\DocumentSection;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for partial updates to document sections.
 */
class UpdateDocumentSectionRequest extends FormRequest
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
            'document_type_id' => 'sometimes|required|exists:document_types,id',
            'position'         => 'sometimes|integer|min:0',
            'heading'          => 'nullable|string|max:255',
            'content'          => 'sometimes|required|string',
            'lang'             => 'sometimes|required|string|max:5',
        ];
    }
}