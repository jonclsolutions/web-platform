<?php
/**
 * @file TranslationController.php
 * @path app/Http/Controllers/Api/TranslationController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages internationalization (i18n) data, including JSON translation file management, language metadata administration, and associated icon assets.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use App\Support\Apps\AppRegistry;
use Illuminate\Http\JsonResponse;

/**
 * @description Controller handling the full lifecycle of language configurations and translation strings.
 * @note Operates on a module-based structure to ensure distinct translation sets for different application sections.
 */
class TranslationController extends Controller
{
    use LogsActivity;

    /**
     * @var string Public disk for icon storage.
     */
    private const ICON_DISK   = 'public';

    /**
     * @var string Folder path for language icons.
     */
    private const ICON_FOLDER = 'translation_images';

    /** @var string Route / input pattern of a translation module ('web', 'shop', …) - no dots or slashes. */
    public const MODULE_PATTERN = '[a-z][a-z0-9_-]{0,31}';

    /** @var string Route / input pattern of a language code ('cz', 'en', 'en-gb', …). */
    public const LANG_PATTERN = '[a-zA-Z]{2}(?:[-_][a-zA-Z0-9]{2,3})?';

    /** @var string Role that passes every permission check (see CheckPermission). */
    private const SYSADMIN_ROLE_NAME = 'sysadmin';

    /** @var string Module of language entries stored without one (the original web-only format). */
    private const DEFAULT_MODULE = 'web';

    /**
     * @var array<int, array<string, mixed>> Language list used while no languages.json exists.
     */
    private const DEFAULT_LANGUAGES = [
        ['code' => 'cz', 'name' => 'Čeština', 'active' => true, 'isBuiltIn' => true, 'icon_path' => null],
        ['code' => 'en', 'name' => 'English',  'active' => true, 'isBuiltIn' => false, 'icon_path' => null],
    ];

    /**
     * @description Refuses a write to a module the user may not edit (finding #32).
     * @param Request $request Current request (authenticated user).
     * @param string $module Module of the URL.
     * @return JsonResponse|null 403 answer, or null when allowed.
     */
    private function denyModuleWrite(Request $request, string $module): ?JsonResponse
    {
        $user = $request->user();
        if ($user->roles()->where('role_name', self::SYSADMIN_ROLE_NAME)->exists()) {
            return null;
        }

        $required = AppRegistry::translationPermission($module);
        if ($required !== null && in_array($required, $user->permissions ?? [], true)) {
            return null;
        }

        $this->logAction($request, $this->logModel($module), 'update_denied', "Translation:{$module}", "Denied change of the {$module} translations (missing {$required}).", null, 'Translation');
        return response()->json(['message' => 'You do not have permission to edit the translations of this module.'], 403);
    }

    /**
     * Saves translation data to a JSON file for a specific module and language.
     */
    public function save(Request $request, string $module): JsonResponse
    {
        if ($denied = $this->denyModuleWrite($request, $module)) {
            return $denied;
        }

        $request->validate([
            'lang' => ['required', 'string', 'max:6', 'regex:/^' . self::LANG_PATTERN . '$/'],
            'data' => 'required|array',
        ]);

        $lang = $request->input('lang');
        $newData = $request->input('data');

        $directory = $this->i18nDirectory($module);
        $filePath  = $directory . '/' . $lang . '.json';

        try {
            if (!File::isDirectory($directory)) {
                File::makeDirectory($directory, 0755, true, true);
            }

            $oldData = File::exists($filePath) ? json_decode(File::get($filePath), true) ?? [] : [];
            $changes = $this->getDeepDiff($oldData, $newData);

            File::put($filePath, json_encode($newData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            $description = $changes
                ? "Update {$lang}.json: " . $this->summarizeDiff($changes)
                : "Update {$lang}.json (no value changes detected)";

            $this->logAction($request, $this->logModel($module), 'update', "Translation:{$module}", $description, null, 'Translation');

            return $this->respond(['detected_changes' => count($changes)]);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            return response()->json(['message' => 'Saving translations failed.'], 500);
        }
    }

    /**
     * Retrieves translation strings for a specific language and module.
     */
    public function show(string $module, string $lang): JsonResponse
    {
        $filePath = $this->i18nDirectory($module) . '/' . $lang . '.json';

        if (!File::exists($filePath)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return $this->respond((object) (json_decode(File::get($filePath), true) ?? []));
    }

    /**
     * Lists available languages for a specific module with generated icon URLs.
     */
    public function getLanguages(string $module): JsonResponse
    {
        $allMeta = self::readLanguagesMeta();

        $filtered = array_values(array_filter($allMeta, fn($l) => $this->moduleOf($l) === $module));

        return $this->respond($this->withIconUrls($filtered));
    }

    /**
     * @description Languages of all applications together (one entry per code, the first one
     *   wins) - the languages of the content the core manages for every application, e.g. the
     *   legal documents and the company details.
     * @return JsonResponse { data: language[] } with icon URLs.
     */
    public function getAllLanguages(): JsonResponse
    {
        $byCode = [];
        foreach (self::readLanguagesMeta() as $lang) {
            if (is_array($lang) && is_string($lang['code'] ?? null)) {
                $byCode[strtolower($lang['code'])] ??= $lang;
            }
        }

        return $this->respond($this->withIconUrls(array_values($byCode)));
    }

    /**
     * @description Replaces the stored icon path of every language by its public URL.
     * @param array<int, array<string, mixed>> $languages Language entries.
     * @return array<int, array<string, mixed>>
     */
    private function withIconUrls(array $languages): array
    {
        foreach ($languages as &$lang) {
            $lang['iconUrl'] = !empty($lang['icon_path']) ? Storage::disk(self::ICON_DISK)->url($lang['icon_path']) : null;
            unset($lang['icon_path']);
        }

        return $languages;
    }

    /**
     * Updates language metadata and handles optional icon uploads for a module.
     */
    public function saveLanguages(Request $request, string $module): JsonResponse
    {
        if ($denied = $this->denyModuleWrite($request, $module)) {
            return $denied;
        }

        $request->validate([
            'languages'   => 'required|json',
            // Raster only - SVG can carry scripts and `image` refuses it anyway (finding #34).
            'icon'        => 'nullable|file|image|mimes:png,jpg,jpeg,webp|max:512',
            'target_code' => 'required_with:icon|string|max:6',
        ]);

        $incoming = json_decode($request->input('languages'), true);
        $entries = validator(['languages' => $incoming], [
            'languages'        => 'required|array',
            'languages.*'      => 'array',
            'languages.*.code' => ['required', 'string', 'distinct', 'regex:/^' . self::LANG_PATTERN . '$/'],
            'languages.*.name' => 'required|string|max:50',
        ]);
        if ($entries->fails()) {
            return response()->json(['message' => 'Invalid language list.', 'errors' => $entries->errors()], 422);
        }
        $allMeta  = self::readLanguagesMeta();

        $otherModulesMeta = array_filter($allMeta, fn($l) => $this->moduleOf($l) !== $module);

        $currentModuleMeta = collect(array_filter($allMeta, fn($l) => $this->moduleOf($l) === $module))
            ->keyBy('code');

        $mergedCurrent = [];
        foreach ($incoming as $lang) {
            $code = $lang['code'];
            $lang['icon_path'] = $currentModuleMeta->get($code)['icon_path'] ?? null;
            $lang['isBuiltIn'] = $currentModuleMeta->get($code)['isBuiltIn'] ?? false;
            $lang['module']    = $module;
            $mergedCurrent[] = $lang;
        }

        if ($request->hasFile('icon')) {
            $code = $request->input('target_code');
            $idx  = $this->findLangIndex($mergedCurrent, $code);

            if ($idx !== null) {
                $this->deleteIconFile($mergedCurrent[$idx]['icon_path']);

                $file      = $request->file('icon');
                $filename  = $code . '_' . \Str::uuid() . '.' . $file->getClientOriginalExtension();
                $path      = $file->storeAs(self::ICON_FOLDER . '/' . $module, $filename, self::ICON_DISK);

                $mergedCurrent[$idx]['icon_path'] = $path;
            }
        }

        $finalMeta = array_merge($otherModulesMeta, $mergedCurrent);
        $this->writeLanguagesMeta($finalMeta);

        // A language left out of the list is removed - its content of the web goes with it.
        foreach (array_diff($currentModuleMeta->keys()->all(), array_column($mergedCurrent, 'code')) as $removed) {
            $this->forgetContent($module, (string) $removed);
        }

        $this->logAction($request, $this->logModel($module), 'update', "Languages:{$module}", 'Language list and metadata update', null, 'Translation', ['icon']);

        return response()->json(null, 204);
    }

    /**
     * Uploads or replaces an icon for a specific language.
     */
    public function storeLanguageIcon(Request $request, string $module, string $code): JsonResponse
    {
        if ($denied = $this->denyModuleWrite($request, $module)) {
            return $denied;
        }

        $request->validate([
            // Raster only - SVG can carry scripts and `image` refuses it anyway (finding #34).
            'icon' => 'required|file|image|mimes:png,jpg,jpeg,webp|max:512',
        ]);

        $meta = self::readLanguagesMeta();
        $idx  = $this->findLangIndex($meta, $code, $module);

        if ($idx === null) {
            return response()->json(['message' => "Language '{$code}' not found."], 404);
        }

        $this->deleteIconFile($meta[$idx]['icon_path'] ?? null);

        $file      = $request->file('icon');
        $filename  = $code . '_' . \Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path      = self::ICON_FOLDER . '/' . $module;

        $iconPath  = $file->storeAs($path, $filename, self::ICON_DISK);

        $meta[$idx]['icon_path'] = $iconPath;
        $this->writeLanguagesMeta($meta);

        $this->logAction($request, $this->logModel($module), 'update', "Languages:{$module}", "Icon uploaded: {$code}", null, 'Translation', ['icon']);

        return $this->respond(['iconUrl' => Storage::disk(self::ICON_DISK)->url($iconPath)]);
    }

    /**
     * Deletes a language metadata entry, its associated icon, and its JSON file.
     */
    public function destroyLanguage(Request $request, string $module, string $code): JsonResponse
    {
        if ($denied = $this->denyModuleWrite($request, $module)) {
            return $denied;
        }

        $allMeta = self::readLanguagesMeta();
        $idx = $this->findLangIndex($allMeta, $code, $module);

        if ($idx === null) {
            return response()->json(['message' => "Language '{$code}' in module '{$module}' not found."], 404);
        }

        if (!empty($allMeta[$idx]['isBuiltIn'])) {
            return response()->json(['message' => 'Built-in languages cannot be deleted.'], 403);
        }

        $this->deleteIconFile($allMeta[$idx]['icon_path'] ?? null);

        $jsonPath = $this->i18nDirectory($module) . '/' . $code . '.json';

        if (File::exists($jsonPath)) {
            File::delete($jsonPath);
        }

        array_splice($allMeta, $idx, 1);
        $this->writeLanguagesMeta($allMeta);

        // Content of the module stored per language loses the language too.
        $this->forgetContent($module, $code);

        $this->logAction($request, $this->logModel($module), 'delete', "Languages:{$module}", "Deleted language: {$code}", null, 'Translation');

        return response()->json(null, 204);
    }

    /**
     * @description Removes the content of the application stored per language of a deleted
     *   language (AppManifest::languageDeleted(), e.g. the FAQ of the web, the order e-mail texts
     *   of the e-shop).
     * @param string $module Translation module (= application id).
     * @param string $code Deleted language code.
     * @return void
     */
    private function forgetContent(string $module, string $code): void
    {
        AppRegistry::app($module)?->languageDeleted($code);
    }

    /**
     * @description Codes of the languages of a module (active or not) - the languages the content
     *   of the module may be stored in (e.g. the FAQ and the jobs of the web).
     * @param string $module Module ('web', 'shop').
     * @return string[] Lower-case codes.
     */
    public static function languageCodes(string $module): array
    {
        $codes = [];
        foreach (self::readLanguagesMeta() as $lang) {
            if (is_array($lang) && is_string($lang['code'] ?? null) && ($lang['module'] ?? self::DEFAULT_MODULE) === $module) {
                $codes[] = strtolower($lang['code']);
            }
        }

        return array_values(array_unique($codes));
    }

    /**
     * Returns absolute directory path for module translations.
     */
    private function i18nDirectory(string $module): string
    {
        return storage_path('app/public/translations/' . $module);
    }

    /**
     * Returns absolute path to the global languages.json metadata file.
     */
    private static function languagesMetaPath(): string
    {
        return storage_path('app/public/translations/languages.json');
    }

    /**
     * Reads and decodes the global language metadata file.
     */
    private static function readLanguagesMeta(): array
    {
        $path = self::languagesMetaPath();
        if (File::exists($path)) {
            return json_decode(File::get($path), true) ?? self::DEFAULT_LANGUAGES;
        }
        return self::DEFAULT_LANGUAGES;
    }

    /**
     * Encodes and writes the global language metadata file.
     */
    private function writeLanguagesMeta(array $meta): void
    {
        $dir = storage_path('app/public/translations');
        if (!File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true, true);
        }
        File::put(
            self::languagesMetaPath(),
            json_encode(array_values($meta), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    /**
     * @description Finds the index of a language code within the metadata array, optionally
     *   only among the entries of one module.
     * @param array $meta Language entries.
     * @param string $code Language code.
     * @param string|null $module Module filter (null = the array is already one module).
     * @return int|null
     */
    private function findLangIndex(array $meta, string $code, ?string $module = null): ?int
    {
        foreach ($meta as $i => $lang) {
            if ($lang['code'] === $code && ($module === null || $this->moduleOf($lang) === $module)) return $i;
        }
        return null;
    }

    /**
     * @description Module of a language entry - entries without one belong to DEFAULT_MODULE.
     * @param array $lang Language entry.
     * @return string
     */
    private function moduleOf(array $lang): string
    {
        return $lang['module'] ?? self::DEFAULT_MODULE;
    }

    /**
     * Deletes the icon file from storage safely.
     */
    private function deleteIconFile(?string $iconPath): void
    {
        if (empty($iconPath)) return;
        try {
            if (Storage::disk(self::ICON_DISK)->exists($iconPath)) {
                Storage::disk(self::ICON_DISK)->delete($iconPath);
            }
        } catch (\Exception $e) {
            Log::warning("Failed to delete icon: " . $e->getMessage());
        }
    }

    /**
     * Performs a deep recursive comparison between two translation arrays.
     */
    private function getDeepDiff(array $old, array $new, string $path = ''): array
    {
        $diff = [];
        foreach ($new as $key => $value) {
            $currentPath = $path ? "{$path}.{$key}" : $key;

            if (!isset($old[$key])) {
                $display = is_array($value) ? '[Array]' : mb_substr((string) $value, 0, 15);
                $diff[]  = "NEW:{$currentPath}({$display})";
            } elseif (is_array($value) && is_array($old[$key])) {
                $diff = array_merge($diff, $this->getDeepDiff($old[$key], $value, $currentPath));
            } elseif ($old[$key] !== $value) {
                $oldVal = mb_substr((string) $old[$key], 0, 10);
                $newVal = mb_substr((string) $value, 0, 10);
                $diff[] = "CHNG:{$currentPath}({$oldVal}->{$newVal})";
            }
        }
        return $diff;
    }

    /**
     * @description Joins the diff items of getDeepDiff() into one shortened string for the log
     * `description`.
     */
    private function summarizeDiff(array $changes): string
    {
        $diffString = implode(' | ', $changes);
        if (mb_strlen($diffString) > 200) {
            $diffString = mb_substr($diffString, 0, 197) . '...';
        }
        return $diffString;
    }

    /**
     * @description Audit log of a module: an application's translations go to its log
     *   (AppManifest::logModel()), everything else (e.g. `admin`) to the core log.
     * @param string $module Translation module.
     * @return class-string Log model for LogsActivity::logAction().
     */
    private function logModel(string $module): string
    {
        return AppRegistry::logModel($module) ?? CoreLog::class;
    }
}
