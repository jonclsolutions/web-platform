<?php
/**
 * @file ImportRequest.php
 * @path app/Apps/JsCreator/Http/Requests/ImportRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Upload of a package to import: `file` - one JSON file (upload profile
 *   `js_creator_import`: extension AND detected type json, size limit of the profile). Its
 *   content is checked by TransferImport.
 * @dependencies AttachmentPolicy (profile js_creator_import), TransferController::import()
 */

namespace App\Apps\JsCreator\Http\Requests;

use App\Apps\JsCreator\JsCreatorApp;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Foundation\Http\FormRequest;

class ImportRequest extends FormRequest
{
    /** @description Access is decided by the route (permission). */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @description One JSON file within the limits of the profile.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['file' => ['required', ...AttachmentPolicy::fileRules(JsCreatorApp::UPLOAD_IMPORT)]];
    }
}
