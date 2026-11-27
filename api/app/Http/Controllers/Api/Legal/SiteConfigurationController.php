<?php
/**
 * @file SiteConfigurationController.php
 * @path app/Http/Controllers/Api/Legal/SiteConfigurationController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Centralized management for site-wide configuration, including company details, localized branding assets, and social media links with file handling.
 * @note The tagline is kept per language (SiteSetting::I18N_FIELDS): cleaned plain text, only the
 *   languages of the modules; switched on, it needs its Czech text (the built-in language
 *   visitors always have). The public configuration gives the text of the requested language
 *   only - a missing one is 'Cannot load text' on the public pages, never another language.
 * @note The copyright line and the footer text are texts of the applications (2026-11) - not here.
 */

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\SiteSetting;
use App\Models\Legal\SocialLink;
use App\Models\Core\CoreLog;
use App\Http\Controllers\Api\TranslationController;
use App\Support\I18n\I18nText;
use App\Support\I18n\MissingTranslations;
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

    /** @description Longest text of a translated field per language (the base columns are VARCHAR(255)). */
    private const I18N_MAX_LENGTH = 255;

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
            'contact_email'        => 'required|email|max:255',
            'contact_phone'        => $rule('contact_phone', 'required|string|max:20'),
            'address'              => $rule('address', 'required|string|max:500'),
            'logo_file'            => 'nullable|file|image|max:2048',
        ]);

        // Only validated fields (the translated ones are cleaned below).
        $data = collect($validated)->except(['logo_file', ...array_values(SiteSetting::I18N_FIELDS)])->all();

        // Texts per language: cleaned, only the languages of the modules; the base column follows
        // the Czech text. A switched-on field needs its Czech text.
        $languages = TranslationController::allLanguageCodes();
        foreach (SiteSetting::I18N_FIELDS as $field => $column) {
            $texts = $this->i18nTexts($request, $field, $column, $settings->{$column}, $languages);
            $data[$column] = $texts;
            $data[$field] = $texts[MissingTranslations::PRIMARY] ?? null;
            if (!in_array($field, $hidden, true) && !isset($texts[MissingTranslations::PRIMARY])) {
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

        // Collect the really changed keys BEFORE save() (isDirty() finds nothing afterwards).
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
     * @note The base columns of the translated fields hold the text of the requested language or
     *   null (missing) - no fallback to Czech; the `*_i18n` maps are sent for the language switch
     *   of the page (null = the field is switched off).
     *
     * @param Request $request Optional query param ?lang=xx (defaults to 'cz').
     * @return JsonResponse Publicly exposed settings and links.
     */
    public function publicShow(Request $request): JsonResponse
    {
        $settings    = SiteSetting::first();
        $lang        = is_string($request->input('lang')) ? strtolower($request->input('lang')) : MissingTranslations::PRIMARY;
        $socialLinks = SocialLink::orderBy('position', 'asc')->get();

        $public = $settings?->toPublicArray();
        if ($public !== null) {
            // The text of the requested language only (null = missing - 'Cannot load text' on the
            // page); a switched-on field always has its map (null = switched off).
            foreach (SiteSetting::I18N_FIELDS as $field => $column) {
                if ($settings->isFieldHidden($field)) {
                    continue;
                }
                $texts = is_array($public[$column] ?? null) ? $public[$column] : [];
                $public[$column] = $texts;
                $text = trim((string) ($texts[$lang] ?? ''));
                $public[$field] = $text === '' ? null : $text;
            }
        }

        return $this->respond([
            // Switched-off fields are null.
            'settings'     => $public,
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
     * @description Texts of one translated field from the request: an array or a JSON string
     *   (multipart with a logo); not sent / not decodable = the stored texts. Each text must be a
     *   string of at most I18N_MAX_LENGTH characters; it is cleaned to plain text (I18nText) and
     *   only the languages of the modules are kept. An older client sending only the base column
     *   gives the Czech text that way.
     * @param Request $request The update request.
     * @param string $field Field key (e.g. 'brand_tagline').
     * @param string $column Its translation column (e.g. 'brand_tagline_i18n').
     * @param mixed $stored Stored texts.
     * @param string[] $languages Allowed language codes.
     * @return array<string, string> Language code => text, empty ones left out.
     * @throws ValidationException When a text is not a string or too long.
     */
    private function i18nTexts(Request $request, string $field, string $column, mixed $stored, array $languages): array
    {
        $raw = $request->input($column);
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        if (!is_array($raw)) {
            $raw = is_array($stored) ? $stored : [];
        } else {
            $validator = Validator::make([$column => $raw], I18nText::rules($column, self::I18N_MAX_LENGTH));
            if ($validator->fails()) {
                throw ValidationException::withMessages([$column => $validator->errors()->first()]);
            }
        }

        $texts = I18nText::clean($raw, self::I18N_MAX_LENGTH, false, $languages);
        $base = $request->input($field);
        if (!isset($texts[MissingTranslations::PRIMARY]) && is_string($base) && trim($base) !== '') {
            $texts[MissingTranslations::PRIMARY] = trim(strip_tags($base));
        }

        return $texts;
    }
}