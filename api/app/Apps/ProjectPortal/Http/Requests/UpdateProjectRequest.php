<?php
/**
 * @file UpdateProjectRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/UpdateProjectRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Same field set as StoreProjectRequest, but nothing is required (partial update) and
 *   no template (checkpoints are copied only when creating). The access token never changes here;
 *   the client passwords belong to the client accounts (ProjectAccountController).
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use App\Apps\ProjectPortal\Models\Project;
use App\Http\Requests\Concerns\PartialUpdateRules;

class UpdateProjectRequest extends StoreProjectRequest
{
    use PartialUpdateRules;

    /**
     * @description Rules of the create request, each field optional; the own order of the
     *   project is not "taken" (Project::originRules()).
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = self::partial(parent::rules());
        unset($rules['template_id']);

        return [
            ...$rules,
            ...Project::originRules((int) $this->route('id')),
            'status' => ['sometimes', 'in:' . implode(',', Project::STATUSES)],
        ];
    }
}
