<?php
namespace App\Http\Requests\Web\WebProject;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\Web\WebProjectCheckpoint;

class UpdateProjectCheckpointRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'label'      => ['sometimes', 'required', 'string', 'max:255'],
            'status'     => ['sometimes', 'in:' . implode(',', WebProjectCheckpoint::STATUSES)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}