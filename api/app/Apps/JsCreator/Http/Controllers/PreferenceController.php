<?php

/**
 * @file PreferenceController.php
 * @path app/Apps/JsCreator/Http/Controllers/PreferenceController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal settings of the signed-in account (`js-creator/preferences`): brand
 *   colours of the editor and hashtag sets of the text of the post. Read and saved whole (the
 *   admin keeps them in one place); an account without a row gets empty settings. Only the own
 *   row is ever read or written - there is no id in the API.
 * @dependencies CreatorPreference, Preferences, LogsActivity (JsCreatorLog).
 */

namespace App\Apps\JsCreator\Http\Controllers;

use App\Apps\JsCreator\Models\CreatorPreference;
use App\Apps\JsCreator\Models\JsCreatorLog;
use App\Apps\JsCreator\Support\Preferences;
use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PreferenceController extends Controller
{
    use LogsActivity;

    /**
     * @description Settings of the signed-in account.
     * @param Request $request
     * @return JsonResponse { colors, hashtag_sets }.
     */
    public function show(Request $request): JsonResponse
    {
        $row = CreatorPreference::query()->ownedBy($request->user())->first();

        return $this->respond($row?->payload ?? Preferences::EMPTY);
    }

    /**
     * @description Saves the settings of the signed-in account (the raw JSON body - texts are
     *   kept as typed).
     * @param Request $request `{ colors, hashtag_sets }`.
     * @return JsonResponse 200 the settings; 422 paths of the errors.
     */
    public function update(Request $request): JsonResponse
    {
        $value = json_decode($request->getContent(), true, 8);
        $errors = Preferences::check($value);
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
        $row = CreatorPreference::query()->updateOrCreate(['user_id' => $request->user()->id], ['payload' => $value]);
        $this->logAction($request, JsCreatorLog::class, 'update', 'Preferences', 'Preferences saved', $row->id, 'Preferences', ['colors', 'hashtag_sets']);

        return $this->respond($value);
    }
}
