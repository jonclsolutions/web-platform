<?php

namespace App\Http\Controllers\Api\Legal;

use App\Http\Controllers\Controller;
use App\Models\Legal\SiteSetting;
use App\Models\Legal\SocialLink;
use App\Models\Shop\ShopLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SiteConfigurationController extends Controller
{
    /**
     * GET /api/legal/config
     * Vrátí firemní nastavení + seznam sociálních sítí.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'settings'     => SiteSetting::first(),
            'social_links' => SocialLink::orderBy('position', 'asc')->get(),
        ]);
    }

    /**
     * PUT /api/legal/config/settings
     * Aktualizace firemních údajů (čistý JSON, bez souboru).
     */
public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name'  => 'required|string|max:255',
            'ico'           => 'required|string|max:20',
            'dic'           => 'nullable|string|max:20',
            'contact_email' => 'required|email|max:255',
            'contact_phone' => 'nullable|string|max:30',
            'address'       => 'required|string|max:500',
            'footer_text'   => 'nullable|string|max:1000',
            'logo_file'     => 'nullable|file|image|max:2048', // Validace loga
        ]);

        $settings = SiteSetting::firstOrCreate([]);
        
        // Zpracování loga
        $data = $request->except(['logo_file']);
        
        if ($request->hasFile('logo_file')) {
            // Smazat staré logo, pokud existuje
            if ($settings->logo_path && Storage::disk('public')->exists($settings->logo_path)) {
                Storage::disk('public')->delete($settings->logo_path);
            }
            // Uložit nové logo
            $data['logo_path'] = $request->file('logo_file')->store('site-logos', 'public');
        }

        $settings->update($data);

        $this->logAction($request, 'update', 'Legal', 'Aktualizace firemních údajů a loga');

        return response()->json($settings);
    }
/**
     * GET /api/public/legal/config
     * Veřejná metoda pro načtení údajů do patičky.
     */
    public function publicShow(): JsonResponse
    {
        $settings = SiteSetting::first();
        $socialLinks = SocialLink::orderBy('position', 'asc')->get();

        return response()->json([
            'settings'     => $settings,
            'social_links' => $socialLinks,
        ]);
    }
    /**
     * POST /api/legal/config/social
     * Vytvoření nového odkazu. Soubor ikony je nepovinný (field: 'icon_file').
     * Pokud je nahrán, uloží se do storage/app/public/social-icons/ 
     * a cesta se zapíše do icon_path.
     */
    public function storeSocial(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => 'required|string|max:100',
            'url'       => 'required|url|max:500',
            'position'  => 'nullable|integer|min:0',
            // Soubor ikony — nepovinný, přijímáme pod klíčem 'icon_file'
            'icon_file' => 'nullable|file|image|max:2048',
        ]);

        $iconPath = null;

        if ($request->hasFile('icon_file') && $request->file('icon_file')->isValid()) {
            $iconPath = $request->file('icon_file')
                ->store('social-icons', 'public');
            // Výsledek: storage/app/public/social-icons/uuid.png
            // Veřejná URL:  /storage/social-icons/uuid.png
        }

        $social = SocialLink::create([
            'name'      => $validated['name'],
            'url'       => $validated['url'],
            'position'  => $validated['position'] ?? 0,
            'icon_path' => $iconPath ?? '',
        ]);

        $this->logAction($request, 'create', 'Legal', "Přidána sociální síť: {$social->name}", $social->id);

        return response()->json($social, 201);
    }

    /**
     * PUT /api/legal/config/social/{id}
     * Aktualizace existujícího odkazu.
     * Pokud přijde nový soubor (icon_file), starý se smaže a nahradí novým.
     * Pokud soubor nepřijde, icon_path zůstane beze změny.
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

        $iconPath = $social->icon_path; // Zachovat stávající cestu

        if ($request->hasFile('icon_file') && $request->file('icon_file')->isValid()) {
            // Smazat starý soubor z disku (pokud existuje)
            if ($social->icon_path && Storage::disk('public')->exists($social->icon_path)) {
                Storage::disk('public')->delete($social->icon_path);
            }
            // Uložit nový soubor
            $iconPath = $request->file('icon_file')->store('social-icons', 'public');
        }

        $social->update([
            'name'      => $validated['name'],
            'url'       => $validated['url'],
            'position'  => $validated['position'] ?? $social->position,
            'icon_path' => $iconPath,
        ]);

        $this->logAction($request, 'update', 'Legal', "Aktualizace sociální sítě: {$social->name}", $social->id);

        return response()->json($social);
    }

    /**
     * DELETE /api/legal/config/social/{id}
     * Smazání odkazu + fyzické smazání souboru ikony z disku.
     */
    public function destroySocial(int $id, Request $request): JsonResponse
    {
        $social = SocialLink::findOrFail($id);

        // Fyzicky smazat soubor ikony z public disku
        if ($social->icon_path && Storage::disk('public')->exists($social->icon_path)) {
            Storage::disk('public')->delete($social->icon_path);
        }

        $name = $social->name;
        $social->delete();

        $this->logAction($request, 'delete', 'Legal', "Smazána sociální síť: {$name}", $id);

        return response()->json(null, 204);
    }

    /**
     * Logování akcí do ShopLog.
     */
    protected function logAction(Request $request, string $eventType, string $module, string $description, ?int $affectedId = null): void
    {
        try {
            $user = $request->user() ?? auth('sanctum')->user();
            ShopLog::create([
                'origin' => $request->ip(),
                'event_type' => $eventType,
                'module' => $module,
                'description' => $description,
                'affected_entity_type' => 'SiteConfiguration',
                'affected_entity_id' => $affectedId,
                'user_id' => $user?->id,
                'context_data' => json_encode($request->except(['logo_file', 'icon_file']), JSON_UNESCAPED_UNICODE),
                'user_id_plain' => (string)($user?->id ?? '0'),
                'user_plain' => $user ? ($user->full_name ?? $user->user_email) : 'Systém',
            ]);
        } catch (\Exception $e) { Log::error("Log error: " . $e->getMessage()); }
    }
}