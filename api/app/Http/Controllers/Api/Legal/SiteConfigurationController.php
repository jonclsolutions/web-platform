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
        return response()->json([
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
        $validated = $request->validate([
            'company_name'         => 'required|string|max:255',
            'ico'                  => 'required|string|max:20',
            'dic'                  => 'nullable|string|max:20',
            'google_analytics_id'  => 'nullable|string|max:20|regex:/^G-[A-Z0-9]{6,10}$/',
            'brand_tagline'        => 'nullable|string|max:255',
            'brand_tagline_i18n'   => 'nullable',
            'copyright_text'       => 'nullable|string|max:255',
            'copyright_text_i18n'  => 'nullable',
            'contact_email'        => 'required|email|max:255',
            'contact_phone'        => 'nullable|string|max:30',
            'address'              => 'required|string|max:500',
            'footer_text'          => 'nullable|string|max:1000',
            'logo_file'            => 'nullable|file|image|max:2048',
        ]);

        $settings = SiteSetting::firstOrCreate([]);
        $data = $request->except(['logo_file', 'brand_tagline_i18n', 'copyright_text_i18n']);

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

        return response()->json($settings);
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

        return response()->json([
            'settings'     => $settings,
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
            'name'      => 'required|string|max:100',
            'url'       => 'required|url|max:500',
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
        return response()->json($social, 201);
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
            'name'      => 'required|string|max:100',
            'url'       => 'required|url|max:500',
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
        return response()->json($social);
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