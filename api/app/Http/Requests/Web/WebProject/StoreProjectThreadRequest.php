<?php
namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectThreadRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'subject'  => ['required', 'string', 'max:255'],
            'priority' => ['required', 'in:low,medium,high,critic'],
            'body'     => ['required', 'string'],
        ];
    }
}