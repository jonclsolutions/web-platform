<?php
namespace App\Http\Requests\Legal\DocumentSection;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDocumentSectionRequest extends FormRequest
{
    public function authorize(): bool 
    { 
        return true; 
    }

    public function rules(): array
    {
        return [
            // Validace ID není nutná v rules, Laravel ho má v routě
            'document_type_id' => 'sometimes|required|exists:document_types,id',
            'position' => 'sometimes|integer|min:0',
            'heading' => 'nullable|string|max:255',
            'content' => 'sometimes|required|string',
        ];
    }
}