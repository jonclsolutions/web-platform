<?php
/**
 * @file StoreDocumentSectionRequest.php
 * @path app/Http/Requests/Legal/DocumentSection/StoreDocumentSectionRequest.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating sections within legal documents.
 */

namespace App\Http\Requests\Legal\DocumentSection;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles validation for document section creation, enforcing structure and language associations.
 */
class StoreDocumentSectionRequest extends FormRequest
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
            'document_type_id' => 'required|exists:document_types,id',
            'position'         => 'integer|min:0',
            'heading'          => 'nullable|string|max:255',
            'content'          => 'required|string',
            'lang'             => 'required|string|max:5',
        ];
    }
}