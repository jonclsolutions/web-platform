<?php
/**
 * @file UpdateFolderRequest.php
 * @path app/Apps/JsCreator/Http/Requests/UpdateFolderRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Rename and / or move a folder of the own workspace (`parent_id` null = to the top
 *   level). The tree rules (depth, own subfolder, unique name) are checked by FolderController.
 * @dependencies StoreFolderRequest (same rules, every field optional), FolderController::update()
 */

namespace App\Apps\JsCreator\Http\Requests;

class UpdateFolderRequest extends StoreFolderRequest
{
    /**
     * @description The rules of a new folder, each field optional.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['name'][0] = 'sometimes';

        return $rules;
    }
}
