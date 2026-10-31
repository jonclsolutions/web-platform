<?php
/**
 * @file SiteConfigurationController.php
 * @path app/Http/Controllers/Api/Legal/SiteConfigurationController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Centralized management for site-wide configuration, including company details, localized branding assets, and social media links with file handling.
 *
 * @refactor-note (2026) Přidáno pole `google_analytics_id` do `updateSettings()` validace -
 * GA4 Measurement ID má formát "G-" následované 10 alfanumerickými znaky, proto přidán
 * i `regex` požadavek navíc k `nullable|string` (je to volitelné pole, web bez GA funguje
 * stejně dál). Hodnota se pak čte na veřejné straně přes `publicShow()`/`index()`, které
 * se neměnily - Eloquent ji serializuje automaticky jako každý jiný sloupec.
 *
 * @refactor-note (2026-08) Logování přesunuto z lokální `logAction()` (chybně mířila do
 * `shop_logs` a ručně `json_encode()`-ovala `context_data`, což při Eloquent `'array'`
 * castu vede k dvojitému enkódování - stejný bug jako u DocumentSectionController) na
 * sdílený `LogsActivity` trait, zapisující do `CoreLog::class`. Site-wide konfigurace je
 * dle dohodnutého Core/Web/Shop rozdělení doménou Core. Volání navíc traitu předávají
 * `['logo_file', 'icon_file']` jako extra vyloučené klíče, ať se do `context_data`
 * nesnaží (marně) serializovat nahrávaný soubor.
 *
 * @refactor-note (2026-08-2) `updateSettings()` dřív logoval jen statický text 'Updated
 * company details and logo' bez informace, KTERÁ pole se změnila - u citlivých/GDPR-
 * relevantních položek (google_analytics_id, kontaktní údaje) to znamenalo, že admin musel
 * rozklikávat celý `context_data`, aby zjistil, co se vlastně stalo. Popis teď obsahuje
 * seznam skutečně změněných klíčů (`array_keys($data)` proti hodnotám PŘED update() voláním),
 * hodnoty samotné zůstávají jen v `context_data` jako dřív - popis je čitelný souhrn, ne
 * duplicitní úložiště dat.
 *
 * @bugfix-note (2026-10-23) Found by the API tests:
 * - SECURITY (mass assignment): updateSettings() saved `$request->except(...)` instead of the
 *   validated data, so any fillable column could be set unchecked - e.g. `logo_path` pointing to
 *   another file of the public disk, which the next logo upload then DELETED. Now only
 *   validated fields are stored (logo_path only from an uploaded logo).
 * - Validation limits longer than the columns (MySQL strict mode → 500 "Data too long"):
 *   contact_phone 30 → 20, footer_text 1000 → 255, social link name 100 → 50, url 500 → 255.
 * - The first save on an empty table used firstOrCreate([]) = INSERT without the required
 *   columns (and with the missing created_at) → 500; now a new row is filled and saved once.
 * @refactor-note (2026-10-24) Open finding #6: success answers go through `respond()` /
 *   `respondPaginated()` - one envelope `{data, meta?}` (App\Traits\RespondsWithData).
 */

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\SiteSetting;
use App\Models\Legal\SocialLink;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * @description Controller responsible for site metadata, branding, and social connectivity.
 * @note Supports i18n data structures for branding fields and manages physical file uploads for logos and icons.
 */
class SiteConfigurationController extends Controller
{
    use LogsActivity;

    /**
     * Fetches current corporate settings and social media configuration.
     *
     * @return JsonResponse Returns configuration settings and ordered social links.
     */
    public function index(): JsonResponse
    {
        return $this->respond([
            'settings'     => SiteSetting::first(),
            'social_links' => SocialLink::orderBy('position', 'asc')->get(),
        ]);
    }

    /**
     * Updates corporate information, branding, and site logo.
     *
     * @param Request $request Validated request containing company info and optional logo file.
     * @return JsonResponse Returns the updated settings object.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $settings = SiteSetting::first() ?? new SiteSetting();
        // Not sent (older client / partial update) = the stored choice stays.
        $hidden = $request->has('hidden_fields')
            ? $this->validatedHiddenFields($request)
            : array_values($settings->hidden_fields ?? []);
        $rule = fn (string $field, string $rules): string => in_array($field, $hidden, true) ? 'nullable' : $rules;

        $validated = $request->validate([
            'company_name'         => 'required|string|max:255',
            'ico'                  => $rule('ico', 'required|string|max:20'),
            'dic'                  => $rule('dic', 'required|string|max:20'),
            'google_analytics_id'  => $rule('google_analytics_id', 'required|string|max:20|regex:/^G-[A-Z0-9]{6,10}$/'),
            'brand_tagline'        => 'nullable|string|max:255',
            'brand_tagline_i18n'   => 'nullable',
            'copyright_text'       => 'nullable|string|max:255',
            'copyright_text_i18n'  => 'nullable',
            'contact_email'        => 'required|email|max:255',
            'contact_phone'        => $rule('contact_phone', 'required|string|max:20'),
            'address'              => $rule('address', 'required|string|max:500'),
            'footer_text'          => $rule('footer_text', 'required|string|max:255'),
            'logo_file'            => 'nullable|file|image|max:2048',
        ]);

        // Only validated fields - see bugfix-note (2026-10-23).
        $data = collect($validated)->except(['logo_file', 'brand_tagline_i18n', 'copyright_text_i18n'])->all();

        // Normalize i18n fields for consistency
        $data['brand_tagline_i18n'] = $this->normalizeI18nField(
            $request->input('brand_tagline_i18n'),
            $settings->brand_tagline_i18n
        );
        $data['copyright_text_i18n'] = $this->normalizeI18nField(
            $request->input('copyright_text_i18n'),
            $settings->copyright_text_i18n
        );

        // Fallback: Ensure primary columns match the Czech (cz) translation
        $data['brand_tagline']  = $data['brand_tagline_i18n']['cz']  ?? ($data['brand_tagline']  ?? $settings->brand_tagline);
        $data['copyright_text'] = $data['copyright_text_i18n']['cz'] ?? ($data['copyright_text'] ?? $settings->copyright_text);

        // A switched-on i18n field needs a text in at least one language (the stored base column
        // does not count - the admin form shows only the translations).
        foreach (['brand_tagline', 'copyright_text'] as $field) {
            if (!in_array($field, $hidden, true) && !$this->hasAnyText($data["{$field}_i18n"], $validated[$field] ?? null)) {
                throw ValidationException::withMessages([$field => __('validation.required', ['attribute' => str_replace('_', ' ', $field)])]);
            }
        }

        // Switched-off fields keep their stored value (switching on restores it).
        foreach ($hidden as $field) {
            foreach (SiteSetting::HIDEABLE_FIELDS[$field] as $column) {
                unset($data[$column]);
            }
        }
        $data['hidden_fields'] = $hidden;

        // Logo handling
        if ($request->hasFile('logo_file')) {
            if ($settings->logo_path && Storage::disk('public')->exists($settings->logo_path)) {
                Storage::disk('public')->delete($settings->logo_path);
            }
            $data['logo_path'] = $request->file('logo_file')->store('site-logos', 'public');
        }

        // Zachytit skutečně změněné klíče PŘED update() (isDirty() po update() by už nic nenašel).
        $settings->fill($data);
        $changedKeys = array_keys($settings->getDirty());
        $settings->save();

        $description = $changedKeys
            ? 'Updated company details: ' . implode(', ', $changedKeys)
            : 'Updated company details (no field changes detected)';

        $this->logAction($request, CoreLog::class, 'update', 'Legal', $description, $settings->id, 'SiteConfiguration', ['logo_file']);

        return $this->respond($settings);
    }

    /**
     * Delivers localized configuration for public consumption.
     *
     * @param Request $request Optional query param ?lang=xx (defaults to 'cz').
     * @return JsonResponse Publicly exposed settings and links.
     */
    public function publicShow(Request $request): JsonResponse
    {
        $settings    = SiteSetting::first();
        $lang        = $request->input('lang', 'cz');
        $socialLinks = SocialLink::orderBy('position', 'asc')->get();

        if ($settings) {
            $taglineI18n   = $settings->brand_tagline_i18n ?? [];
            $copyrightI18n = $settings->copyright_text_i18n ?? [];

            // Apply language fallback logic: requested lang -> 'cz' -> base column
            $settings->brand_tagline  = $taglineI18n[$lang] ?? $taglineI18n['cz'] ?? $settings->brand_tagline;
            $settings->copyright_text = $copyrightI18n[$lang] ?? $copyrightI18n['cz'] ?? $settings->copyright_text;
        }

        return $this->respond([
            // Switched-off fields are null - see refactor-note (2026-10-31).
            'settings'     => $settings?->toPublicArray(),
            'social_links' => $socialLinks,
        ]);
    }

    /**
     * Creates a new social media entry.
     *
     * @param Request $request Data for social link including optional icon file.
     * @return JsonResponse Returns the created resource.
     */
    public function storeSocial(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => 'required|string|max:50',
            'url'       => 'required|url|max:255',
            'position'  => 'nullable|integer|min:0',
            'icon_file' => 'nullable|file|image|max:2048',
        ]);

        $iconPath = null;
        if ($request->hasFile('icon_file') && $request->file('icon_file')->isValid()) {
            $iconPath = $request->file('icon_file')->store('social-icons', 'public');
        }

        $social = SocialLink::create([
            'name'      => $validated['name'],
            'url'       => $validated['url'],
            'position'  => $validated['position'] ?? 0,
            'icon_path' => $iconPath ?? '',
        ]);

        $this->logAction($request, CoreLog::class, 'create', 'Legal', "Added social network: {$social->name}", $social->id, 'SocialLink', ['icon_file']);
        return $this->respond($social, 201);
    }

    /**
     * Updates an existing social media link.
     *
     * @param Request $request Data for update.
     * @param int $id The social link ID.
     * @return JsonResponse Returns the updated resource.
     */
    public function updateSocial(Request $request, int $id): JsonResponse
    {
        $social = SocialLink::findOrFail($id);
        $validated = $request->validate([
            'name'      => 'required|string|max:50',
            'url'       => 'required|url|max:255',
            'position'  => 'nullable|integer|min:0',
            'icon_file' => 'nullable|file|image|max:2048',
        ]);

        $iconPath = $social->icon_path;

        if ($request->hasFile('icon_file') && $request->file('icon_file')->isValid()) {
            if ($social->icon_path && Storage::disk('public')->exists($social->icon_path)) {
                Storage::disk('public')->delete($social->icon_path);
            }
            $iconPath = $request->file('icon_file')->store('social-icons', 'public');
        }

        $social->update([
            'name'      => $validated['name'],
            'url'       => $validated['url'],
            'position'  => $validated['position'] ?? $social->position,
            'icon_path' => $iconPath,
        ]);

        $this->logAction($request, CoreLog::class, 'update', 'Legal', "Updated social network: {$social->name}", $social->id, 'SocialLink', ['icon_file']);
        return $this->respond($social);
    }

    /**
     * Deletes a social link and its associated icon file.
     *
     * @param int $id The social link ID.
     * @param Request $request The request object.
     * @return JsonResponse Returns 204 on success.
     */
    public function destroySocial(int $id, Request $request): JsonResponse
    {
        $social = SocialLink::findOrFail($id);

        if ($social->icon_path && Storage::disk('public')->exists($social->icon_path)) {
            Storage::disk('public')->delete($social->icon_path);
        }

        $name = $social->name;
        $social->delete();

        $this->logAction($request, CoreLog::class, 'delete', 'Legal', "Deleted social network: {$name}", $id, 'SocialLink');
        return response()->json(null, 204);
    }

    /**
     * @description Reads and validates `hidden_fields` - an array, or a JSON string (multipart
     *   upload with a logo sends it like the i18n fields); null = nothing switched off.
     * @param Request $request The update request.
     * @return array<int, string> Unique keys of SiteSetting::HIDEABLE_FIELDS.
     * @throws ValidationException When the value is not a list of known field keys.
     */
    private function validatedHiddenFields(Request $request): array
    {
        $raw = $request->input('hidden_fields') ?? [];
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }

        $validator = Validator::make(['hidden_fields' => $raw], [
            'hidden_fields'   => 'present|array',
            'hidden_fields.*' => ['string', Rule::in(array_keys(SiteSetting::HIDEABLE_FIELDS))],
        ]);
        if ($validator->fails()) {
            throw ValidationException::withMessages(['hidden_fields' => __('validation.in', ['attribute' => 'hidden fields'])]);
        }

        return array_values(array_unique($raw));
    }

    /**
     * @description Whether an i18n field has a non-empty text in any language (or the base column).
     * @param array<string, mixed> $i18n Texts by language.
     * @param mixed $base The base column value sent in the request.
     * @return bool True when some text is filled in.
     */
    private function hasAnyText(array $i18n, mixed $base): bool
    {
        foreach ([...array_values($i18n), $base] as $text) {
            if (is_string($text) && trim($text) !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * Normalizes i18n inputs from either JSON arrays or strings.
     *
     * @param mixed $raw The raw input.
     * @param mixed $existing The current database value.
     * @return array Normalized associative array.
     */
    private function normalizeI18nField($raw, $existing): array
    {
        $existing = is_array($existing) ? $existing : (json_decode($existing ?? '[]', true) ?? []);

        if (is_array($raw)) return $raw;

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) return $decoded;
        }

        return $existing;
    }
}