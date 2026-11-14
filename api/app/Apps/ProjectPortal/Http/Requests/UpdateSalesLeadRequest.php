<?php
/**
 * @file UpdateSalesLeadRequest.php
 * @path app/Apps/ProjectPortal/Http/Requests/UpdateSalesLeadRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Validation logic for updating existing sales leads - the rules and messages of
 *   StoreSalesLeadRequest, each field optional (partial update).
 */

namespace App\Apps\ProjectPortal\Http\Requests;

use App\Http\Requests\Concerns\PartialUpdateRules;

/**
 * @description Handles request validation for updating existing sales lead data.
 */
class UpdateSalesLeadRequest extends StoreSalesLeadRequest
{
    use PartialUpdateRules;

    /**
     * @description Rules of the create request, each field optional.
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return self::partial(parent::rules());
    }
}
