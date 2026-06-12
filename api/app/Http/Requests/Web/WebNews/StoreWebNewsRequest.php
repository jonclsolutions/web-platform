<?php

namespace App\Http\Requests\Web\WebNews;

use Illuminate\Foundation\Http\FormRequest;

class StoreWebNewsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'    => ['required', 'string', 'min:3', 'max:255'],
            'message'  => ['required', 'string'],
            'author'   => ['required', 'string', 'max:255'],
            'thema'    => ['required', 'string', 'max:255', 'in:Milník,Update,Info,Novinka,Upozornění,Error,Údržba,Akce'],
            'bullet_1' => ['nullable', 'string', 'max:255'],
            'bullet_2' => ['nullable', 'string', 'max:255'],
            'bullet_3' => ['nullable', 'string', 'max:255'],
            'bullet_4' => ['nullable', 'string', 'max:255'],
        ];
    }

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