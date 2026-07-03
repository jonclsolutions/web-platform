<?php

namespace App\Http\Requests\Legal\DocumentSection;

use Illuminate\Foundation\Http\FormRequest;

class StoreDocumentSectionRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'document_type_id' => 'required|exists:document_types,id',
            'position' => 'integer|min:0',
            'heading' => 'nullable|string|max:255',
            'content' => 'required|string',
            'lang' => 'required|string|max:5', // Přidáno: povinný jazykový kód
        ];
    }
}