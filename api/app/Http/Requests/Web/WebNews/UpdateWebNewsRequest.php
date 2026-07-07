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
            'message'  => ['sometimes', 'required', 'string'],
            'author'   => ['sometimes', 'required', 'string', 'max:255'],
            'thema'    => ['sometimes', 'required', 'string', 'max:255', 'in:Milník,Update,Info,Novinka,Upozornění,Error,Údržba,Akce'],
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
            'title.required'   => 'Titulka novinky je povinná.',
            'title.min'        => 'Titulek musí mít 3 až 255 znaků.',
            'message.required' => 'Obsah zprávy nesmí být prázdný.',
            'author.required'  => 'Autor musí být vyplněn.',
            'thema.required'   => 'Téma je povinné.',
            'thema.in'         => 'Vybrané téma je neplatné.',
        ];
    }
}