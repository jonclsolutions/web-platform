<?php
/**
 * @file UpdateCoreExternalLinkRequest.php
 * @path app/Http/Requests/Core/CoreExternalLink/UpdateCoreExternalLinkRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation rules for updating an existing CoreExternalLink. Authorization
 * (permission `core-external-links-update`) is enforced at the route/middleware level
 * (see api.php) - `authorize()` returns true here, consistent with the rest of the
 * codebase's FormRequest pattern.
 */

namespace App\Http\Requests\Core\CoreExternalLink;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCoreExternalLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'url'  => ['required', 'url', 'max:500'],
        ];
    }
}