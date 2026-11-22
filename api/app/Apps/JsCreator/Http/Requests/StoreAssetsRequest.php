<?php
/**
 * @file StoreAssetsRequest.php
 * @path app/Apps/JsCreator/Http/Requests/StoreAssetsRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Upload of images to the own library: `files[]` (1 … max_files of the upload profile
 *   `js_creator_image`) - JPG / PNG / WebP by content AND extension, size limit of the profile,
 *   at most 8000 px per side (LibraryImage also refuses more than 40 megapixels). With
 *   `kind=icon` the files are own icons: profile `js_creator_icon` - PNG / JPG only.
 * @dependencies AttachmentPolicy (profiles js_creator_image, js_creator_icon), AssetController::store()
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\JsCreatorApp;
use App\Apps\JsCreator\Models\CreatorAsset;
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
        $name = $this->kind() === CreatorAsset::KIND_ICON ? JsCreatorApp::UPLOAD_ICON : JsCreatorApp::UPLOAD_IMAGE;
        $profile = AttachmentPolicy::profile($name);

        return [
            'kind'    => ['sometimes', 'string', 'in:' . implode(',', CreatorAsset::KINDS)],
            'files'   => ['required', 'array', 'min:1', 'max:' . $profile['max_files']],
            'files.*' => [...AttachmentPolicy::fileRules($name), 'dimensions:max_width=8000,max_height=8000'],
        ];
    }

    /**
     * @description Kind of the uploaded files (image of the library unless `kind=icon`).
     * @return string CreatorAsset::KIND_IMAGE | KIND_ICON.
     */
    public function kind(): string
    {
        return $this->input('kind') === CreatorAsset::KIND_ICON ? CreatorAsset::KIND_ICON : CreatorAsset::KIND_IMAGE;
    }
}
