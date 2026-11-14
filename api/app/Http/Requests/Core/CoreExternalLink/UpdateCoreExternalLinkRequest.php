<?php
/**
 * @file UpdateCoreExternalLinkRequest.php
 * @path app/Http/Requests/Core/CoreExternalLink/UpdateCoreExternalLinkRequest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validation rules for updating an existing CoreExternalLink - the same full set as creating
 *   (name and URL are always sent). Authorization (permission `core-external-links-update`) is
 *   enforced at the route/middleware level.
 */

namespace App\Http\Requests\Core\CoreExternalLink;

/**
 * @description Same rules as StoreCoreExternalLinkRequest (the form always sends both fields).
 */
class UpdateCoreExternalLinkRequest extends StoreCoreExternalLinkRequest
{
}
