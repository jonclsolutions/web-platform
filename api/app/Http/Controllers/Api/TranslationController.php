<?php
/**
 * @file TranslationController.php
 * @path app/Http/Controllers/Api/TranslationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages internationalization (i18n) data, including JSON translation file management, language metadata administration, and associated icon assets.
 *
 * @refactor-note (2026-08-7) MIGRACE LOGOVÁNÍ na sdílený `LogsActivity` trait místo
 * lokální duplicitní logAction(). Doménově beze změny (WebLog::class - spravuje se pod
 * `web/edit-website`, permission `web-view-edit-website`). Lokální verze měla
 * nestandardní 6. parametr `array $changes` (diff starých/nových hodnot překladu), který
 * sdílený trait nepodporuje - diff se teď stejně jako u SiteConfigurationController
 * (viz @refactor-note 2026-08-2 tamtéž) vkládá přímo do čitelného `$description`, ne do
 * zvláštního parametru. `context_data` necháváme na traitu (automaticky ořízne velikost).
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Web\WebLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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

    /**
     * Saves translation data to a JSON file for a specific module and language.
     */
    public function save(Request $request, string $module): JsonResponse
    {
        $request->validate([
            'lang' => 'required|string|max:5',
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

            $this->logAction($request, WebLog::class, 'update', "Translation:{$module}", $description, null, 'Translation');

            return response()->json(['status' => 'success', 'detected_changes' => count($changes)]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
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

        return response()->json(json_decode(File::get($filePath), true));
    }

    /**
     * Lists available languages for a specific module with generated icon URLs.
     */
    public function getLanguages(string $module): JsonResponse
    {
        $allMeta = $this->readLanguagesMeta();

        $filtered = array_values(array_filter($allMeta, fn($l) => ($l['module'] ?? '') === $module));

        foreach ($filtered as &$lang) {
            $lang['iconUrl'] = !empty($lang['icon_path']) ? Storage::disk(self::ICON_DISK)->url($lang['icon_path']) : null;
            unset($lang['icon_path']);
        }

        return response()->json(['languages' => $filtered]);
    }

    /**
     * Updates language metadata and handles optional icon uploads for a module.
     */
    public function saveLanguages(Request $request, string $module): JsonResponse
    {
        $request->validate([
            'languages'   => 'required|json',
            'icon'        => 'nullable|file|image|mimes:png,jpg,jpeg,webp,svg|max:512',
            'target_code' => 'required_with:icon|string|max:5',
        ]);

        $incoming = json_decode($request->input('languages'), true);
        $allMeta  = $this->readLanguagesMeta();

        $otherModulesMeta = array_filter($allMeta, fn($l) => ($l['module'] ?? 'web') !== $module);

        $currentModuleMeta = collect(array_filter($allMeta, fn($l) => ($l['module'] ?? 'web') === $module))
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

        $this->logAction($request, WebLog::class, 'update', "Languages:{$module}", 'Language list and metadata update', null, 'Translation', ['icon']);

        return response()->json(['status' => 'success']);
    }

    /**
     * Uploads or replaces an icon for a specific language.
     */
    public function storeLanguageIcon(Request $request, string $module, string $code): JsonResponse
    {
        $request->validate([
            'icon' => 'required|file|image|mimes:png,jpg,jpeg,webp,svg|max:512',
        ]);

        $meta = $this->readLanguagesMeta();
        $idx  = $this->findLangIndex($meta, $code);

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

        $this->logAction($request, WebLog::class, 'update', "Languages:{$module}", "Icon uploaded: {$code}", null, 'Translation', ['icon']);

        return response()->json([
            'status'   => 'success',
            'iconUrl'  => Storage::disk(self::ICON_DISK)->url($iconPath),
        ]);
    }

    /**
     * Deletes a language metadata entry, its associated icon, and its JSON file.
     */
    public function destroyLanguage(Request $request, string $module, string $code): JsonResponse
    {
        $allMeta = $this->readLanguagesMeta();
        $idx = null;
        foreach ($allMeta as $i => $lang) {
            if ($lang['code'] === $code && ($lang['module'] ?? '') === $module) {
                $idx = $i; break;
            }
        }

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

        $this->logAction($request, WebLog::class, 'delete', "Languages:{$module}", "Deleted language: {$code}", null, 'Translation');

        return response()->json(null, 204);
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
    private function languagesMetaPath(): string
    {
        return storage_path('app/public/translations/languages.json');
    }

    /**
     * Reads and decodes the global language metadata file.
     */
    private function readLanguagesMeta(): array
    {
        $path = $this->languagesMetaPath();
        if (File::exists($path)) {
            return json_decode(File::get($path), true) ?? $this->defaultLanguages();
        }
        return $this->defaultLanguages();
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
            $this->languagesMetaPath(),
            json_encode(array_values($meta), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    /**
     * Default language configuration.
     */
    private function defaultLanguages(): array
    {
        return [
            ['code' => 'cz', 'name' => 'Čeština', 'active' => true, 'isBuiltIn' => true, 'icon_path' => null],
            ['code' => 'en', 'name' => 'English',  'active' => true, 'isBuiltIn' => false, 'icon_path' => null],
        ];
    }

    /**
     * Finds index of a specific language code within the metadata array.
     */
    private function findLangIndex(array $meta, string $code): ?int
    {
        foreach ($meta as $i => $lang) {
            if ($lang['code'] === $code) return $i;
        }
        return null;
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
     * @description Sbalí pole diff-položek z getDeepDiff() do jednoho ořízlého řetězce
     * vhodného pro vložení do $description (nahrazuje dřívější zvláštní parametr
     * `array $changes` v lokální logAction() - viz refactor-note v hlavičce souboru).
     */
    private function summarizeDiff(array $changes): string
    {
        $diffString = implode(' | ', $changes);
        if (mb_strlen($diffString) > 200) {
            $diffString = mb_substr($diffString, 0, 197) . '...';
        }
        return $diffString;
    }
}