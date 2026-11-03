<?php

/**
 * @file UploadRulesController.php
 * @path app/Http/Controllers/Api/UploadRulesController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public read-only endpoint with the attachment rules of every upload profile
 * (allowed extensions, file count and size limits) - the frontend uses it to refuse a wrong
 * file right when it is chosen and to list the allowed types in that warning.
 * @note The values come from AttachmentPolicy, the same source the FormRequests validate with,
 * so the browser and the server never disagree. The rules are no secret (no authentication).
 * @dependencies
 * - App\Support\Uploads\AttachmentPolicy: the profiles.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Http\JsonResponse;

class UploadRulesController extends Controller
{
    /**
     * @description Returns all upload profiles: `{ data: { <profile>: { extensions, max_files,
     * max_file_size_mb, max_total_size_mb } } }`.
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        return $this->respond(AttachmentPolicy::publicRules());
    }
}
