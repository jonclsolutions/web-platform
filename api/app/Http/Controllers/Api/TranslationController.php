<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Web\WebLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;

class TranslationController extends Controller
{
    // Disk a složka pro ikonky jazyků
    private const ICON_DISK   = 'public';
    private const ICON_FOLDER = 'translation_images';

    // ═══════════════════════════════════════════════════════════
    // PŘEKLADY — uložení JSON souboru
    // ═══════════════════════════════════════════════════════════

public function save(Request $request, string $module): JsonResponse
{
    $request->validate([
        'lang' => 'required|string|max:5',
        'data' => 'required|array',
    ]);

    $lang = $request->input('lang');
    $newData = $request->input('data');

    // Cesta: storage/app/public/translations/{module}/{lang}.json
    $directory = $this->i18nDirectory($module);
    $filePath  = $directory . '/' . $lang . '.json';

    try {
        if (!File::isDirectory($directory)) {
            File::makeDirectory($directory, 0755, true, true);
        }

        $oldData = File::exists($filePath) ? json_decode(File::get($filePath), true) ?? [] : [];
        $changes = $this->getDeepDiff($oldData, $newData);

        File::put($filePath, json_encode($newData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        $this->logAction($request, 'update', "Translation:{$module}", "Update {$lang}.json", null, $changes);

        return response()->json(['status' => 'success', 'detected_changes' => count($changes)]);
    } catch (\Exception $e) {
        return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
    }
}

    /** * Absolutní cesta ke složce s i18n JSON soubory na straně serveru
     */

    /**
     * GET /api/translations/{lang}
     * Načtení překladů pro daný jazyk.
     */
    public function show(string $module, string $lang): JsonResponse
    {
        $filePath = $this->i18nDirectory($module) . '/' . $lang . '.json';

        if (!File::exists($filePath)) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(json_decode(File::get($filePath), true));
    }

    // ═══════════════════════════════════════════════════════════
    // JAZYKY — správa metadat + ikonek
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /api/languages
     * Vrátí seznam jazyků uložených v languages.json.
     * Ikonky jsou dodány jako veřejné URL (ne base64), aby se
     * neposílaly velké base64 řetězce při každém requestu.
     */
   public function getLanguages(string $module): JsonResponse
    {
        $allMeta = $this->readLanguagesMeta();
        
        // OPRAVA: Použití správné proměnné $module a filtrování
        $filtered = array_values(array_filter($allMeta, fn($l) => ($l['module'] ?? '') === $module));

        foreach ($filtered as &$lang) {
            $lang['iconUrl'] = !empty($lang['icon_path']) ? Storage::disk(self::ICON_DISK)->url($lang['icon_path']) : null;
            unset($lang['icon_path']);
        }

        return response()->json(['languages' => $filtered]);
    }

    /**
     * POST /api/languages
     * Uložení celého seznamu jazyků (bez ikonek — ty se nahrávají přes storeLanguageIcon).
     * Frontend posílá pole languages se záznamy bez iconBase64 (jen metadata).
     */

/**
     * POST /api/languages
     * Uložení seznamu jazyků a volitelně ikonky.
     * Očekává FormData: 
     * - languages: JSON string (pole objektů)
     * - icon: File (volitelné)
     * - target_code: String (povinné, pokud je přiložena ikona)
     */
   /**
     * POST /api/languages/{module}
     * Uložení seznamu jazyků a volitelně ikonky.
     */
public function saveLanguages(Request $request, string $module): JsonResponse
    {
        // 1. Validace příchozích dat
        $request->validate([
            'languages'   => 'required|json',
            'icon'        => 'nullable|file|image|mimes:png,jpg,jpeg,webp,svg|max:512',
            'target_code' => 'required_with:icon|string|max:5',
        ]);

        $incoming = json_decode($request->input('languages'), true);
        $allMeta  = $this->readLanguagesMeta(); // Načte všechna metadata ze souboru

        // 2. Oddělíme metadata ostatních modulů od toho našeho
        // Ponecháme záznamy, které NEPATŘÍ do aktuálního modulu
        $otherModulesMeta = array_filter($allMeta, fn($l) => ($l['module'] ?? 'web') !== $module);
        
        // Získáme stávající data pro náš modul pro zachování icon_path a isBuiltIn
        $currentModuleMeta = collect(array_filter($allMeta, fn($l) => ($l['module'] ?? 'web') === $module))
            ->keyBy('code');

        // 3. Sloučení metadat pro aktuální modul
        $mergedCurrent = [];
        foreach ($incoming as $lang) {
            $code = $lang['code'];
            // Zachováme icon_path a isBuiltIn z existujících dat modulu
            $lang['icon_path'] = $currentModuleMeta->get($code)['icon_path'] ?? null;
            $lang['isBuiltIn'] = $currentModuleMeta->get($code)['isBuiltIn'] ?? false;
            $lang['module']    = $module; // Ujistíme se, že je nastaven modul
            $mergedCurrent[] = $lang;
        }

        // 4. Zpracování souboru ikonky, pokud byl přiložen
        if ($request->hasFile('icon')) {
            $code = $request->input('target_code');
            $idx  = $this->findLangIndex($mergedCurrent, $code);

            if ($idx !== null) {
                // Smazat starou ikonu z disku
                $this->deleteIconFile($mergedCurrent[$idx]['icon_path']);
                
                // Uložit novou ikonu do: translation_images/{module}/...
                $file      = $request->file('icon');
                $filename  = $code . '_' . \Str::uuid() . '.' . $file->getClientOriginalExtension();
                $path      = $file->storeAs(self::ICON_FOLDER . '/' . $module, $filename, self::ICON_DISK);
                
                $mergedCurrent[$idx]['icon_path'] = $path;
            }
        }

        // 5. Spojíme ostatní moduly a náš aktualizovaný modul a uložíme
        $finalMeta = array_merge($otherModulesMeta, $mergedCurrent);
        $this->writeLanguagesMeta($finalMeta);
        
        // 6. Logování akce
        $this->logAction($request, 'update', "Languages:{$module}", 'Aktualizace seznamu jazyků a metadat');

        return response()->json(['status' => 'success']);
    }

    /**
     * POST /api/languages/{code}/icon
     * Nahrání / výměna ikonky konkrétního jazyka.
     * Přijímá multipart/form-data s polem "icon" (soubor).
     * Vrátí novou veřejnou URL ikonky.
     */
// Nová signatura metody s modulem
public function storeLanguageIcon(Request $request, string $module, string $code): JsonResponse
{
    $request->validate([
        'icon' => 'required|file|image|mimes:png,jpg,jpeg,webp,svg|max:512',
    ]);

    $meta = $this->readLanguagesMeta();
    $idx  = $this->findLangIndex($meta, $code);

    if ($idx === null) {
        return response()->json(['message' => "Jazyk '{$code}' nenalezen."], 404);
    }

    $this->deleteIconFile($meta[$idx]['icon_path'] ?? null);

    // Uloží do: translation_images/{module}/{code}_{uuid}.{ext}
    $file      = $request->file('icon');
    $filename  = $code . '_' . \Str::uuid() . '.' . $file->getClientOriginalExtension();
    $path      = self::ICON_FOLDER . '/' . $module;
    
    $iconPath  = $file->storeAs($path, $filename, self::ICON_DISK);

    $meta[$idx]['icon_path'] = $iconPath;
    $this->writeLanguagesMeta($meta);

    $this->logAction($request, 'update', "Languages:{$module}", "Nahrána ikonka: {$code}");

    return response()->json([
        'status'   => 'success',
        'iconUrl'  => Storage::disk(self::ICON_DISK)->url($iconPath),
    ]);
}

    /**
     * DELETE /api/languages/{code}
     * Smazání jazyka: odstraní metadata + ikonku z disku.
     * Vestavěné jazyky (isBuiltIn = true) nelze smazat.
     */
/**
     * DELETE /api/languages/{code}
     * Smazání jazyka: odstraní metadata + ikonku z disku + JSON s překlady.
     */
    public function destroyLanguage(Request $request, string $module, string $code): JsonResponse
    {
        $allMeta = $this->readLanguagesMeta();
        // OPRAVA: Musíme hledat v konkrétním modulu
        $idx = null;
        foreach ($allMeta as $i => $lang) {
            if ($lang['code'] === $code && ($lang['module'] ?? '') === $module) {
                $idx = $i; break;
            }
        }

        if ($idx === null) {
            return response()->json(['message' => "Jazyk '{$code}' v modulu '{$module}' nenalezen."], 404);
        }

        if (!empty($allMeta[$idx]['isBuiltIn'])) {
            return response()->json(['message' => 'Vestavěný jazyk nelze smazat.'], 403);
        }

        $this->deleteIconFile($allMeta[$idx]['icon_path'] ?? null);

        // OPRAVA: Použití parametru $module, který nyní do metody přichází
        $jsonPath = $this->i18nDirectory($module) . '/' . $code . '.json';
        
        if (File::exists($jsonPath)) {
            File::delete($jsonPath);
        }

        array_splice($allMeta, $idx, 1);
        $this->writeLanguagesMeta($allMeta); // Zapíšeme upravené globální pole

        $this->logAction($request, 'delete', "Languages:{$module}", "Smazán jazyk: {$code}");

        return response()->json(null, 204);
    }

    // ═══════════════════════════════════════════════════════════
    // SOUKROMÉ POMOCNÉ METODY
    // ═══════════════════════════════════════════════════════════

    /** Absolutní cesta ke složce s i18n JSON soubory */
    private function i18nDirectory(string $module): string
    {
        // Cesta: storage/app/public/translations/{module}
        return storage_path('app/public/translations/' . $module);
    }

    // Cesta ke GLOÁLNÍMU souboru languages.json (dle vašeho stromu)
    private function languagesMetaPath(): string
    {
        return storage_path('app/public/translations/languages.json');
    }

    /** Načte pole metadat jazyků, nebo vrátí výchozí (pouze CZ) */
    private function readLanguagesMeta(): array
    {
        $path = $this->languagesMetaPath();

        if (File::exists($path)) {
            return json_decode(File::get($path), true) ?? $this->defaultLanguages();
        }

        return $this->defaultLanguages();
    }

    /** Zapíše pole metadat jazyků */
    private function writeLanguagesMeta(array $meta): void
    {
        // Cesta ke složce s languages.json (kořen translations)
        $dir = storage_path('app/public/translations'); 
        if (!File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true, true);
        }
        File::put(
            $this->languagesMetaPath(),
            json_encode(array_values($meta), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    /** Výchozí metadata když soubor neexistuje */
    private function defaultLanguages(): array
    {
        return [
            ['code' => 'cz', 'name' => 'Čeština', 'active' => true, 'isBuiltIn' => true, 'icon_path' => null],
            ['code' => 'en', 'name' => 'English',  'active' => true, 'isBuiltIn' => false, 'icon_path' => null],
        ];
    }

    /** Najde index jazyka v poli metadat dle kódu */
    private function findLangIndex(array $meta, string $code): ?int
    {
        foreach ($meta as $i => $lang) {
            if ($lang['code'] === $code) return $i;
        }
        return null;
    }

    /**
     * Smaže soubor ikonky z public storage.
     * Bezpečně ignoruje neexistující cestu.
     */
    private function deleteIconFile(?string $iconPath): void
{
    if (empty($iconPath)) return;

    // Pokud $iconPath obsahuje 'shop/' nebo 'web/', Storage to zvládne
    try {
        if (Storage::disk(self::ICON_DISK)->exists($iconPath)) {
            Storage::disk(self::ICON_DISK)->delete($iconPath);
        }
    } catch (\Exception $e) {
        Log::warning("Nepodařilo se smazat ikonku: " . $e->getMessage());
    }
}

    // ═══════════════════════════════════════════════════════════
    // DIFF + LOGOVÁNÍ
    // ═══════════════════════════════════════════════════════════

    /** Rekurzivní porovnání polí pro zjištění změn v překladech */
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

    /** Sjednocené logování akcí do WebLog */
    protected function logAction(
        Request $request,
        string $eventType,
        string $module,
        string $description,
        ?int $affectedEntityId = null,
        array $changes = []
    ): void {
        try {
            $user = $request->user() ?? auth('sanctum')->user();

            $diffString = implode(' | ', $changes);
            if (mb_strlen($diffString) > 200) {
                $diffString = mb_substr($diffString, 0, 197) . '...';
            }

            WebLog::create([
                'origin'               => $request->ip(),
                'event_type'           => $eventType,
                'module'               => $module,
                'description'          => $description,
                'affected_entity_type' => 'Translation',
                'affected_entity_id'   => $affectedEntityId,
                'user_id'              => $user?->id,
                'context_data'         => json_encode([
                    'lg' => $request->input('lang') ?? null,
                    'df' => $diffString ?: 'no_val_change',
                ], JSON_UNESCAPED_UNICODE),
                'user_id_plain' => (string) ($user?->id ?? '0'),
                'user_plain'    => $user?->user_email ?? 'system',
            ]);
        } catch (\Exception $e) {
            Log::error('Chyba logování (Translation): ' . $e->getMessage());
        }
    }
}