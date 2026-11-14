<?php
/**
 * @file UpdateDocumentSectionRequest.php
 * @path app/Http/Requests/Legal/DocumentSection/UpdateDocumentSectionRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation logic for updating existing legal document sections - the rules of
 *   StoreDocumentSectionRequest, each field optional (partial update).
 */

namespace App\Http\Requests\Legal\DocumentSection;

use App\Http\Requests\Concerns\PartialUpdateRules;

/**
 * @description Handles validation for partial updates to document sections.
 */
class UpdateDocumentSectionRequest extends StoreDocumentSectionRequest
{
    use PartialUpdateRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return self::partial(parent::rules());
    }
}
