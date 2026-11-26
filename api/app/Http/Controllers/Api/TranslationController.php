<?php
/**
 * @file TranslationController.php
 * @path app/Http/Controllers/Api/TranslationController.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages internationalization (i18n) data, including JSON translation file management, language metadata administration, and associated icon assets.
 * @note A missing text is never replaced by the text of another language: the public pages get
 *   'Cannot load text' in its place (show() with `complete`), and a language is switched on only
 *   complete (saveLanguages, completeness()).
 * @note A deleted language (destroyLanguage, or left out of the saved list) takes everything stored
 *   in it with it: its translation file and icon, the content of the applications using the
 *   module's languages, the page titles of the module and the shared site texts (forgetContent()).
 * @dependencies AppRegistry, MissingTranslations, I18nText, PageTitle, SiteSetting.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use App\Support\Apps\AppRegistry;
use Illuminate\Http\JsonResponse;
use App\Support\I18n\PlainText;
use App\Support\I18n\MissingTranslations;
use App\Support\I18n\I18nText;
use App\Support\I18n\LanguageCompleteness;
use App\Models\Legal\PageTitle;
use App\Models\Legal\SiteSetting;
use Illuminate\Support\Facades\DB;

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

    /** @var string Dot path of a text of a translation file (`home.hero.title`, `items.0.label`). */
    public const KEY_PATH_PATTERN = '[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*';

    /** @var int Most texts one save of the editor may change. */
    private const MAX_CHANGES = 5000;

    /** @var int Longest text of a translation (characters). */
    private const MAX_TEXT_LENGTH = 10000;

    /** @var int How long the write lock of a language file is held at most (seconds). */
    private const WRITE_LOCK_SECONDS = 10;

    /** @var int How long a save waits for another save of the same language (seconds). */
    private const WRITE_LOCK_WAIT_SECONDS = 5;

    /**
     * @var array<int, array<string, mixed>> Languages of a module that has none stored yet.
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
     * @description Saves the texts of one language of a module: the changed texts of the editors
     *   (`changes` - merged into the stored file) or a whole uploaded JSON file (`data`,
     *   `upload: true`).
     * @note `changes` [{path, value}]: only these texts are written, every other text of the file
     *   stays as stored - two admins (or two tabs) saving different texts of one language never
     *   overwrite each other. A path must be a text of the primary language or of the file itself
     *   (422, errors.unknown, nothing written). The answer has the texts as stored
     *   (`values` - plain text, PlainText::fromHtml()).
     * @note `base` of a change = the stored text the edit started from: when the stored text is
     *   another one now (saved meanwhile in another tab / by another admin), nothing is written
     *   and 409 lists those texts with their stored version (`errors.conflicts`) - `force: true` writes
     *   the changes anyway (the admin chose to overwrite).
     * @note An upload must have exactly the keys of the primary language (Czech on the server;
     *   for Czech itself its current keys) - missing or extra keys are refused with 422 and the
     *   lists of keys, nothing is written (a wrong file must never wipe texts). In an uploaded
     *   other language empty texts are left out (= missing, the editor marks them, the public page
     *   shows its fallback instead of an empty text).
     * @note Writes of one language run one at a time (cache lock) and replace the file at once
     *   (temporary file + rename) - a reader never gets a half-written file.
     */
    public function save(Request $request, string $module): JsonResponse
    {
        if ($denied = $this->denyModuleWrite($request, $module)) {
            return $denied;
        }

        $request->validate([
            'lang'            => ['required', 'string', 'max:6', 'regex:/^' . self::LANG_PATTERN . '$/'],
            // the whole language (upload of a JSON file) or only the changed texts (the editors)
            'data'            => 'required_without:changes|prohibits:changes|array',
            'changes'         => 'required_without:data|array|min:1|max:' . self::MAX_CHANGES,
            'changes.*'       => 'array:path,value,base',
            'changes.*.path'  => ['required', 'string', 'max:255', 'regex:/^' . self::KEY_PATH_PATTERN . '$/'],
            'changes.*.value' => ['present', 'nullable', 'string', 'max:' . self::MAX_TEXT_LENGTH],
            'changes.*.base'  => ['sometimes', 'nullable', 'string', 'max:' . self::MAX_TEXT_LENGTH],
            'force'           => 'sometimes|boolean|prohibits:data',
            'upload'          => 'sometimes|boolean|prohibits:changes',
        ]);

        $lang = $request->input('lang');
        $partial = $request->has('changes');
        // plain text only: older HTML (<br>, <p>) becomes new lines, any other tag is removed
        $newData = $partial ? [] : PlainText::tree($request->input('data'));

        if ($request->boolean('upload')) {
            if ($mismatch = $this->uploadMismatch($module, $newData)) {
                return response()->json(['message' => 'The file does not have the keys of the primary language.'] + $mismatch, 422);
            }
            if (strtolower($lang) !== MissingTranslations::PRIMARY) {
                $newData = self::withoutEmptyTexts($newData);
            }
        }

        $directory = $this->i18nDirectory($module);
        $filePath  = $directory . '/' . $lang . '.json';

        try {
            if (!File::isDirectory($directory)) {
                File::makeDirectory($directory, 0755, true, true);
            }

            // one write of the language at a time: a save reads the stored texts and writes them back
            $result = Cache::lock("translations:{$module}:{$lang}", self::WRITE_LOCK_SECONDS)
                ->block(self::WRITE_LOCK_WAIT_SECONDS, function () use ($partial, $request, $module, $filePath, $newData) {
                    $oldData = self::readTexts($filePath);
                    $saved = [];
                    if ($partial) {
                        if ($oldData === null) {
                            // an unreadable file is never replaced by the few changed texts
                            throw new \RuntimeException("The stored texts of {$filePath} are not valid JSON.");
                        }
                        $changes = $request->input('changes');
                        if (!$request->boolean('force') && ($conflicts = self::conflictsOf($oldData, $changes)) !== []) {
                            return response()->json([
                                'message' => 'The texts were changed meanwhile.',
                                'errors'  => ['conflicts' => array_slice($conflicts, 0, self::UPLOAD_MISMATCH_LIST), 'conflict_count' => count($conflicts)],
                            ], 409);
                        }
                        [$newData, $saved, $unknown] = self::mergeChanges($oldData, MissingTranslations::primary($module) ?? [], $changes);
                        if ($unknown !== []) {
                            return response()->json([
                                'message' => 'The texts are not in the translations of the module.',
                                'errors'  => ['unknown' => array_slice($unknown, 0, self::UPLOAD_MISMATCH_LIST), 'unknown_count' => count($unknown)],
                            ], 422);
                        }
                    }
                    self::writeTexts($filePath, $newData);

                    return [$oldData ?? [], $newData, $saved];
                });
            if ($result instanceof JsonResponse) {
                return $result;
            }
            [$oldData, $newData, $saved] = $result;
            $changes = $this->getDeepDiff($oldData, $newData);

            $action = $request->boolean('upload') ? 'Upload' : 'Update';
            $description = $changes
                ? "{$action} {$lang}.json: " . $this->summarizeDiff($changes)
                : "{$action} {$lang}.json (no value changes detected)";

            $this->logAction($request, $this->logModel($module), 'update', "Translation:{$module}", $description, null, 'Translation');

            return $this->respond($partial
                ? ['detected_changes' => count($changes), 'values' => (object) $saved]
                : ['detected_changes' => count($changes)]);
        } catch (\Exception $e) {
            report($e); // full detail (class, file, trace) to the core log
            return response()->json(['message' => 'Saving translations failed.'], 500);
        }
    }

    /**
     * @description Writes the changed texts of the editor into the stored texts of a language.
     * @param array $stored Texts of the language as stored.
     * @param array $primary Texts of the primary language (the keys a language may have).
     * @param array<int, array{path: string, value: ?string}> $changes Changed texts.
     * @return array{0: array, 1: array<string, string>, 2: array<int, string>} The merged texts,
     *   the texts as stored by path (plain text) and the paths that are no text of the module.
     */
    private static function mergeChanges(array $stored, array $primary, array $changes): array
    {
        $known = array_flip(array_merge(MissingTranslations::keyPaths($primary), MissingTranslations::keyPaths($stored)));
        $merged = $stored;
        $saved = [];
        $unknown = [];
        foreach ($changes as $change) {
            $path = (string) $change['path'];
            $text = PlainText::fromHtml((string) ($change['value'] ?? ''));
            if (!isset($known[$path]) || !self::setText($merged, $path, $text)) {
                $unknown[] = $path;
                continue;
            }
            $saved[$path] = $text;
        }

        return [$merged, $saved, $unknown];
    }

    /**
     * @description Changes whose stored text is no longer the one their edit started from (`base`).
     * @param array $stored Texts of the language as stored.
     * @param array<int, array{path: string, value: ?string, base?: ?string}> $changes Changed texts.
     * @return array<int, array{path: string, value: string}> The paths with their stored text.
     */
    private static function conflictsOf(array $stored, array $changes): array
    {
        $conflicts = [];
        foreach ($changes as $change) {
            if (!array_key_exists('base', $change)) {
                continue;
            }
            $current = self::textAt($stored, (string) $change['path']);
            if ($current !== (string) ($change['base'] ?? '')) {
                $conflicts[] = ['path' => (string) $change['path'], 'value' => $current];
            }
        }

        return $conflicts;
    }

    /**
     * @description Text at a dot path.
     * @param array $data Texts.
     * @param string $path Dot path.
     * @return string The text ('' when there is none or it is a group).
     */
    private static function textAt(array $data, string $path): string
    {
        $node = $data;
        foreach (explode('.', $path) as $part) {
            if (!is_array($node) || !array_key_exists($part, $node)) {
                return '';
            }
            $node = $node[$part];
        }

        return is_scalar($node) ? (string) $node : '';
    }

    /**
     * @description Sets a text at a dot path (creates the missing groups).
     * @param array $data Texts (changed in place).
     * @param string $path Dot path of the text.
     * @param string $text Text.
     * @return bool false when the path runs through a text or ends at a group (nothing changed).
     */
    private static function setText(array &$data, string $path, string $text): bool
    {
        $parts = explode('.', $path);
        $last = array_pop($parts);
        $node = &$data;
        foreach ($parts as $part) {
            if (!array_key_exists($part, $node)) {
                $node[$part] = [];
            } elseif (!is_array($node[$part])) {
                return false;
            }
            $node = &$node[$part];
        }
        if (array_key_exists($last, $node) && is_array($node[$last])) {
            return false;
        }
        $node[$last] = $text;

        return true;
    }

    /**
     * @description Texts of a language file.
     * @param string $path Translation file.
     * @return array|null Its texts ([] when it does not exist yet), null when it is not valid JSON.
     */
    private static function readTexts(string $path): ?array
    {
        if (!File::exists($path)) {
            return [];
        }
        $data = json_decode(File::get($path), true);

        return is_array($data) ? $data : null;
    }

    /**
     * @description Replaces a translation file at once: the texts go to a temporary file beside it,
     *   which then takes its place (rename) - a reader gets the old or the new file, never a part.
     * @param string $path Translation file.
     * @param array $data Texts.
     * @throws \RuntimeException When the file cannot be written.
     */
    private static function writeTexts(string $path, array $data): void
    {
        $temporary = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
        $written = File::put($temporary, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        if ($written === false || !@rename($temporary, $path)) {
            File::delete($temporary);
            throw new \RuntimeException("The translation file {$path} could not be written.");
        }
    }

    /**
     * @description Texts of a language of a module: as stored (the editors), or with `complete=1`
     *   as the visitors get them (the public pages) - every key of Czech, a missing or empty text
     *   'Cannot load text', also for a language without a file yet; never the texts of another
     *   language (MissingTranslations::complete()).
     * @param Request $request `complete` (boolean).
     * @param string $module Module.
     * @param string $lang Language code.
     * @return JsonResponse The texts; 404 when there are none (stored: no file; complete: no Czech file either).
     */
    public function show(Request $request, string $module, string $lang): JsonResponse
    {
        $filePath = $this->i18nDirectory($module) . '/' . $lang . '.json';
        $stored = File::exists($filePath) ? (json_decode(File::get($filePath), true) ?? []) : null;

        if ($request->boolean('complete')) {
            $completed = MissingTranslations::complete($module, is_array($stored) ? $stored : []);
            if ($completed !== null) {
                return $this->respond((object) $completed);
            }
        }
        if ($stored === null) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return $this->respond((object) $stored);
    }

    /**
     * @description What every language of a module other than Czech still lacks (texts, page
     *   titles, content) - a language may be switched on only when it lacks nothing; the window
     *   "Jazyky" says why it cannot be yet.
     * @param Request $request Current request (permission of the module).
     * @param string $module Module.
     * @return JsonResponse { code: { part: count } } ({} for a complete language).
     */
    public function completeness(Request $request, string $module): JsonResponse
    {
        if ($denied = $this->denyModuleWrite($request, $module)) {
            return $denied;
        }
        $result = [];
        foreach (self::moduleLanguages($module) as $lang) {
            $code = (string) ($lang['code'] ?? '');
            if ($code === '' || strtolower($code) === MissingTranslations::PRIMARY) {
                continue;
            }
            $result[$code] = (object) LanguageCompleteness::missing($module, $code);
        }

        return $this->respond((object) $result);
    }

    /**
     * Lists available languages for a specific module with generated icon URLs.
     */
    public function getLanguages(string $module): JsonResponse
    {
        return $this->respond($this->withIconUrls(self::moduleLanguages($module)));
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
        foreach (self::readLanguagesMeta() ?: self::DEFAULT_LANGUAGES as $lang) {
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
     * @note A language other than Czech is switched on only when it lacks nothing (texts, page
     *   titles, content - LanguageCompleteness): 422 with `errors.incomplete` {code: {part: count}},
     *   nothing saved. Switching off is always allowed.
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
        ], [
            // readable for the admin (instead of "languages.5.code field format is invalid")
            'languages.*.code.regex' => 'The language code must be 2 lowercase letters (e.g. sk, de, fr).',
        ]);
        if ($entries->fails()) {
            return response()->json(['message' => 'Invalid language list.', 'errors' => $entries->errors()], 422);
        }
        $allMeta  = self::readLanguagesMeta();

        $otherModulesMeta = array_filter($allMeta, fn($l) => $this->moduleOf($l) !== $module);

        $currentModuleMeta = collect(self::moduleLanguages($module))->keyBy('code');

        $mergedCurrent = [];
        // A language other than Czech is switched on only when it lacks nothing (texts, page titles,
        // content) - visitors never get a half translated language (LanguageCompleteness).
        $incomplete = [];
        foreach ($incoming as $lang) {
            $code = (string) $lang['code'];
            $wasActive = !empty($currentModuleMeta->get($code)['active']);
            if (!empty($lang['active']) && !$wasActive && strtolower($code) !== MissingTranslations::PRIMARY) {
                $missing = LanguageCompleteness::missing($module, $code);
                if ($missing !== []) {
                    $incomplete[$code] = $missing;
                }
            }
        }
        if ($incomplete !== []) {
            return response()->json([
                'message' => 'A language can be switched on only with all its texts.',
                'errors'  => ['incomplete' => $incomplete],
            ], 422);
        }

        foreach ($incoming as $lang) {
            $code = $lang['code'];
            // the URL of the icon is derived from its path when read (withIconUrls) - one sent by
            // the admin names its own host (a local copy wrote http://127.0.0.1:8000/… into the seed)
            unset($lang['iconUrl']);
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
                // Extension of the real content, never of the client's name (public disk, see storeLanguageIcon()).
                $filename  = $code . '_' . \Str::uuid() . '.' . $file->guessExtension();
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
        // Extension of the real content (the validated image type), never of the client's file
        // name: the public disk is served from the application's origin, where a `.html` / `.js`
        // name would turn the upload into a page or a script.
        $filename  = $code . '_' . \Str::uuid() . '.' . $file->guessExtension();
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
     * @description Removes everything stored in a deleted language, so nothing of a language that
     *   no longer exists stays in the database: the content of every application using the
     *   languages of the module (AppManifest::languageModule() / languageDeleted() - e.g. the FAQ
     *   and the inquiry e-mail of the web, the order e-mail of the e-shop and of the project
     *   portal), the page titles of the module and - once no module has the language any more -
     *   the slogan and the copyright of the site settings (they offer the languages of all modules).
     * @note Called after languages.json is written (the language is already gone from the list).
     * @param string $module Translation module (= application id).
     * @param string $code Deleted language code.
     * @return void
     */
    private function forgetContent(string $module, string $code): void
    {
        $code = strtolower($code);
        DB::transaction(function () use ($module, $code) {
            foreach (AppRegistry::apps() as $app) {
                if ($app->languageModule() === $module) {
                    $app->languageDeleted($code);
                }
            }
            foreach (PageTitle::query()->where('area', $module)->get() as $row) {
                I18nText::forget($row, ['title_i18n'], $code);
            }
            if (!in_array($code, self::allLanguageCodes(), true) && ($settings = SiteSetting::query()->first())) {
                I18nText::forget($settings, ['brand_tagline_i18n', 'copyright_text_i18n'], $code);
            }
        });
    }

    /**
     * @description Codes of the languages of every module (lower case) - the languages the texts
     *   shared by all modules (site settings, page titles of the administration) may be stored in.
     * @return string[]
     */
    public static function allLanguageCodes(): array
    {
        $codes = [];
        foreach (self::readLanguagesMeta() ?: self::DEFAULT_LANGUAGES as $lang) {
            if (is_array($lang) && is_string($lang['code'] ?? null)) {
                $codes[] = strtolower($lang['code']);
            }
        }

        return array_values(array_unique($codes));
    }

    /**
     * @description Codes of the languages of a module (active or not) - the languages the content
     *   of the module may be stored in (e.g. the FAQ and the jobs of the web).
     * @param string $module Module (application id).
     * @return string[] Lower-case codes.
     */
    public static function languageCodes(string $module): array
    {
        return array_values(array_unique(array_map(fn (array $lang) => strtolower($lang['code']), self::moduleLanguages($module))));
    }

    /** @description Keys listed per kind in a refused upload (the rest is only counted). */
    private const UPLOAD_MISMATCH_LIST = 20;

    /**
     * @description Compares the keys of an uploaded file with the primary language of the module.
     * @param string $module Module.
     * @param array $data Uploaded texts.
     * @return array{missing: array<int, string>, unexpected: array<int, string>, missing_count: int, unexpected_count: int}|null
     *   Null when the keys match (or the module has no primary texts yet to compare with).
     */
    private function uploadMismatch(string $module, array $data): ?array
    {
        $primary = MissingTranslations::primary($module);
        if ($primary === null) {
            return null;
        }
        $expected = MissingTranslations::keyPaths($primary);
        $given = MissingTranslations::keyPaths($data);
        $missing = array_values(array_diff($expected, $given));
        $unexpected = array_values(array_diff($given, $expected));
        if ($missing === [] && $unexpected === []) {
            return null;
        }

        return [
            'missing'          => array_slice($missing, 0, self::UPLOAD_MISMATCH_LIST),
            'unexpected'       => array_slice($unexpected, 0, self::UPLOAD_MISMATCH_LIST),
            'missing_count'    => count($missing),
            'unexpected_count' => count($unexpected),
        ];
    }

    /**
     * @description Leaves out the empty texts of groups (a missing text is not stored); lists stay
     *   as they are, a group left empty is dropped.
     * @param array $data Texts.
     * @return array
     */
    private static function withoutEmptyTexts(array $data): array
    {
        if (array_is_list($data)) {
            return $data;
        }
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $value = self::withoutEmptyTexts($value);
                if ($value === []) {
                    unset($data[$key]);
                    continue;
                }
                $data[$key] = $value;
            } elseif ($value === null || (is_string($value) && trim($value) === '')) {
                unset($data[$key]);
            }
        }

        return $data;
    }

    /**
     * @description Codes of the active languages of a module (the ones visitors can switch to).
     * @param string $module Module (application id).
     * @return string[] Codes as stored (the names of the translation files).
     */
    public static function activeLanguageCodes(string $module): array
    {
        return array_values(array_unique(array_map(
            fn (array $lang) => (string) $lang['code'],
            array_filter(self::moduleLanguages($module), fn (array $lang) => !empty($lang['active']))
        )));
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
        $meta = File::exists($path) ? json_decode(File::get($path), true) : null;

        return is_array($meta) ? $meta : [];
    }

    /**
     * @description Languages of one module: its stored entries, or DEFAULT_LANGUAGES while the
     *   module has none stored yet.
     * @param string $module Module (application id).
     * @return array<int, array<string, mixed>> Entries with a code, each with `module`.
     */
    private static function moduleLanguages(string $module): array
    {
        $stored = array_values(array_filter(
            self::readLanguagesMeta(),
            fn ($lang) => is_array($lang) && is_string($lang['code'] ?? null) && ($lang['module'] ?? null) === $module
        ));

        return $stored ?: array_map(fn (array $lang) => $lang + ['module' => $module], self::DEFAULT_LANGUAGES);
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
     * @description Module of a language entry (null for an entry without one).
     * @param array $lang Language entry.
     * @return string
     */
    private function moduleOf(array $lang): ?string
    {
        return $lang['module'] ?? null;
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
