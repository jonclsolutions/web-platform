<?php
/**
 * @file ProjectLoginRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/ProjectLoginRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sign-in to the client portal of a project: login name of a client account +
 *   its password (the project comes from the link).
 * @dependencies ProjectPublicController::login()
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProjectLoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /**
     * @description Both values are required; lengths are capped (no huge input hashed).
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'max:255'],
        ];
    }
}
