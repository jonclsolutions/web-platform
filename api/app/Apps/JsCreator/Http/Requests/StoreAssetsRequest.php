<?php
/**
 * @file StoreAssetsRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreAssetsRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Upload of images to the own library: `files[]` (1 … max_files of the upload profile
 *   `js_creator_image`) - JPG / PNG / WebP by content AND extension, size limit of the profile,
 *   at most 8000 px per side (LibraryImage also refuses more than 40 megapixels).
 * @dependencies AttachmentPolicy (profile js_creator_image), AssetController::store()
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\JsCreatorApp;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;

class StoreAssetsRequest extends FormRequest
{
    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description Whitelisted images within the limits of the profile.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $profile = AttachmentPolicy::profile(JsCreatorApp::UPLOAD_IMAGE);

        return [
            'files'   => ['required', 'array', 'min:1', 'max:' . $profile['max_files']],
            'files.*' => [...AttachmentPolicy::fileRules(JsCreatorApp::UPLOAD_IMAGE), 'dimensions:max_width=8000,max_height=8000'],
        ];
    }
}
