<?php
namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectThreadMessageRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return ['body' => ['required', 'string']];
    }
}