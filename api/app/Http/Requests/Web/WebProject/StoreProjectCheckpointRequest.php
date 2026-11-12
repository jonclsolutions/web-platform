<?php
namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Web\WebProjectCheckpoint;

class StoreProjectCheckpointRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'label'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status'     => ['nullable', 'in:' . implode(',', WebProjectCheckpoint::STATUSES)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}