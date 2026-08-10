<?php
/**
 * @file StoreWebNewsRequest.php
 * @path app/Http/Requests/Web/WebNews/StoreWebNewsRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new web news articles.
 */

namespace App\Http\Requests\Web\WebNews;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for new news content creation.
 */
class StoreWebNewsRequest extends FormRequest
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
            'title'    => ['required', 'string', 'min:3', 'max:255'],
            'message'  => ['required', 'string', 'max:10000'],
            'author'   => ['required', 'string', 'max:255'],
            'thema'    => ['required', 'string', 'max:255', 'in:Milník,Update,Info,Novinka,Upozornění,Error,Údržba,Akce'],
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
            'message.max'      => 'Obsah zprávy může mít maximálně 10 000 znaků.',
            'author.required'  => 'Autor musí být vyplněn.',
            'thema.required'   => 'Téma je povinné.',
            'thema.in'         => 'Vybrané téma je neplatné.',
        ];
    }
}