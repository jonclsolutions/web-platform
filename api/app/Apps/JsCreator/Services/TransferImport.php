<?php
/**
 * @file TransferImport.php
 * @path app/Apps/JsCreator/Services/TransferImport.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Imports a package of JS Creator (TransferPackage) into the own workspace of a
 *   section - all or nothing:
 *   1. the JSON and its shape are checked (TransferPackage::check), then every file: images /
 *      own icons are decoded and re-encoded (LibraryImage - metadata stripped, PNG / JPG only
 *      for icons), fonts must be a font of the declared format (FontFile);
 *   2. a font whose face and content are already among the own fonts is reused, another one with
 *      a taken face gets a free family name (`Family 2`);
 *   3. names taken by own items of the same kind (also in the trash) or by another item of the
 *      import get ` (2)`, ` (3)` … (a name already ending with ` (n)` counts on from it);
 *   4. the quota is checked for all new files together;
 *   5. everything is written in one transaction (files written before a failure are deleted);
 *      the ids of the package are replaced by the new ids in every document, usages are synced,
 *      thumbnails of the new templates and blocks are drawn by the browser (thumb_stale).
 * @usage `$summary = TransferImport::run($userId, 'images', $json);`
 * @dependencies TransferPackage, TemplateDocument, LibraryImage, FontFile, WorkspaceQuota,
 *   WorkspaceFiles, TemplateUsages, the models of the workspace.
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\JsCreatorApp;
use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Support\FontFile;
use App\Apps\JsCreator\Support\LibraryImage;
use App\Apps\JsCreator\Support\TemplateDocument;
use App\Apps\JsCreator\Support\TransferPackage;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use App\Support\Uploads\AttachmentPolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

final class TransferImport
{
    /** @description Most renamed items listed in the answer. */
    private const MAX_RENAMED = 50;

    /** @var list<array{type: string, from: string, to: string}> Items imported under another name. */
    private array $renamed = [];

    /** @var string[] Files written so far (deleted when the import fails). */
    private array $stored = [];

    /**
     * @param int $userId Owner of the new items.
     * @param string $section Section of the import.
     */
    private function __construct(private readonly int $userId, private readonly string $section)
    {
    }

    /**
     * @description Imports a package.
     * @param int $userId Owner.
     * @param string $section Section of the import.
     * @param string $json Content of the uploaded file.
     * @return array{templates: int, blocks: int, sets: int, assets: int, fonts: int, fonts_reused: int, renamed: list<array{type: string, from: string, to: string}>, template_ids: int[], block_ids: int[]}
     * @throws InvalidPackageException The file is not a valid package (422).
     * @throws QuotaExceededException The new files do not fit into the quota.
     */
    public static function run(int $userId, string $section, string $json): array
    {
        try {
            $data = json_decode($json, true, 128, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw new InvalidPackageException(['package' => 'The file is not valid JSON.']);
        }
        $package = TransferPackage::check($data, $section);
        if ($package->errors() !== []) {
            throw new InvalidPackageException($package->errors());
        }

        return (new self($userId, $section))->import($package);
    }

    /**
     * @description Checks the files, plans the names and writes everything.
     * @param TransferPackage $package Checked package.
     * @return array<string, mixed> See run().
     */
    private function import(TransferPackage $package): array
    {
        [$images, $fonts] = $this->files($package);
        $fontPlan = $this->planFonts($package->items('fonts'), $fonts);

        $bytes = array_sum(array_map(fn (array $p) => strlen($p['image']) + strlen($p['thumb']), $images))
            + array_sum(array_map(fn (array $f) => $f['reuse'] === null ? strlen($f['binary']) : 0, $fontPlan));
        WorkspaceQuota::ensureRoom($this->userId, $bytes);

        try {
            return DB::transaction(fn () => $this->write($package, $images, $fontPlan));
        } catch (Throwable $e) {
            WorkspaceFiles::delete($this->stored);
            throw $e;
        }
    }

    /**
     * @description Decodes and checks every file of the package.
     * @param TransferPackage $package
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, string>} Processed images and font files by their index.
     * @throws InvalidPackageException A file is not what it claims to be.
     */
    private function files(TransferPackage $package): array
    {
        $errors = [];
        $images = [];
        foreach ($package->items('assets') as $i => $asset) {
            $profile = AttachmentPolicy::profile($asset['kind'] === CreatorAsset::KIND_ICON ? JsCreatorApp::UPLOAD_ICON : JsCreatorApp::UPLOAD_IMAGE);
            $binary = base64_decode($asset['data'], true);
            if ($binary === false || $binary === '' || strlen($binary) > $profile['max_file_kb'] * 1024) {
                $errors["assets.{$i}.data"] = 'The image is not valid or too large.';
                continue;
            }
            try {
                $images[$i] = LibraryImage::processKind($binary, $asset['kind']);
            } catch (RuntimeException) {
                $errors["assets.{$i}.data"] = $asset['kind'] === CreatorAsset::KIND_ICON
                    ? 'The icon is not a readable PNG or JPG image.'
                    : 'The file is not a readable image.';
            }
            if (count($errors) >= TransferPackage::MAX_ERRORS) {
                break;
            }
        }
        $fonts = [];
        $maxFont = AttachmentPolicy::profile(JsCreatorApp::UPLOAD_FONT)['max_file_kb'] * 1024;
        foreach ($package->items('fonts') as $i => $font) {
            $binary = base64_decode($font['data'], true);
            if ($binary === false || strlen($binary) > $maxFont || FontFile::detect(substr($binary, 0, 4)) !== $font['format']) {
                $errors["fonts.{$i}.data"] = 'The file is not a font of the declared format.';
                continue;
            }
            $fonts[$i] = $binary;
        }
        if ($errors !== []) {
            throw new InvalidPackageException(array_slice($errors, 0, TransferPackage::MAX_ERRORS, true));
        }

        return [$images, $fonts];
    }

    /**
     * @description Decides for each font: reuse an own font of the same face and content, or
     *   store it under its family - or under a free family name when the face is taken.
     * @param list<array<string, mixed>> $items Fonts of the package.
     * @param array<int, string> $binaries Their files by index.
     * @return array<int, array{item: array<string, mixed>, binary: string, reuse: int|null, family: string}>
     */
    private function planFonts(array $items, array $binaries): array
    {
        $own = CreatorFont::query()->ownedBy($this->userId)->get();
        $faces = [];
        foreach ($own as $font) {
            $faces[self::face($font->family, $font->weight, $font->style)] = $font;
        }
        $plan = [];
        foreach ($items as $i => $item) {
            $binary = $binaries[$i];
            $existing = $faces[self::face($item['family'], $item['weight'], $item['style'])] ?? null;
            $content = $existing !== null ? Storage::disk(WorkspaceFiles::DISK)->get($existing->path) : null;
            if ($existing instanceof CreatorFont && $content !== null && hash_equals(hash('sha256', $content), hash('sha256', $binary))) {
                $plan[$i] = ['item' => $item, 'binary' => $binary, 'reuse' => $existing->id, 'family' => $existing->family];
                continue;
            }
            $family = $item['family'];
            for ($n = 2; isset($faces[self::face($family, $item['weight'], $item['style'])]); $n++) {
                $suffix = " {$n}";
                $family = rtrim(mb_substr($item['family'], 0, TransferPackage::MAX_FAMILY - mb_strlen($suffix))) . $suffix;
            }
            if ($family !== $item['family']) {
                $this->rename('font', $item['family'], $family);
            }
            $faces[self::face($family, $item['weight'], $item['style'])] = true;
            $plan[$i] = ['item' => $item, 'binary' => $binary, 'reuse' => null, 'family' => $family];
        }

        return $plan;
    }

    /**
     * @description Writes the files and rows (inside the transaction of import()).
     * @param TransferPackage $package
     * @param array<int, array<string, mixed>> $images Processed images by index.
     * @param array<int, array<string, mixed>> $fontPlan See planFonts().
     * @return array<string, mixed> See run().
     */
    private function write(TransferPackage $package, array $images, array $fontPlan): array
    {
        $fontMap = [];
        $newFonts = 0;
        foreach ($fontPlan as $plan) {
            if ($plan['reuse'] !== null) {
                $fontMap[$plan['item']['id']] = $plan['reuse'];
                continue;
            }
            $path = $this->put('fonts', $plan['item']['format'], $plan['binary']);
            $font = CreatorFont::create([
                'user_id' => $this->userId, 'family' => $plan['family'], 'weight' => $plan['item']['weight'], 'style' => $plan['item']['style'],
                'format' => $plan['item']['format'], 'path' => $path, 'size_bytes' => strlen($plan['binary']),
            ]);
            $fontMap[$plan['item']['id']] = $font->id;
            $newFonts++;
        }

        $assetMap = [];
        $assetNames = [];
        foreach ($package->items('assets') as $i => $item) {
            $kind = $item['kind'];
            $assetNames[$kind] ??= $this->taken(CreatorAsset::withTrashed()->ownedBy($this->userId)->where('kind', $kind)->pluck('name')->all());
            $p = $images[$i];
            $asset = CreatorAsset::create([
                'user_id' => $this->userId, 'kind' => $kind, 'name' => $this->uniqueName('asset', $item['name'], $assetNames[$kind], TransferPackage::MAX_ASSET_NAME),
                'path' => $this->put('library', $p['extension'], $p['image']), 'thumb_path' => $this->put('thumbs', 'webp', $p['thumb']),
                'mime' => $p['mime'], 'width' => $p['width'], 'height' => $p['height'], 'size_bytes' => strlen($p['image']) + strlen($p['thumb']),
            ]);
            $assetMap[$item['id']] = $asset->id;
        }

        $blockMap = [];
        $blockNames = $this->taken(CreatorBlock::withTrashed()->ownedBy($this->userId)->where('section', $this->section)->pluck('name')->all());
        foreach ($package->items('blocks') as $item) {
            $document = TransferPackage::remap($item['document'], $assetMap, $fontMap, []);
            $block = CreatorBlock::create([
                'user_id' => $this->userId, 'section' => $this->section, 'name' => $this->uniqueName('block', $item['name'], $blockNames, TransferPackage::MAX_NAME),
                'width' => $item['width'], 'height' => $item['height'], 'schema_version' => TemplateDocument::SCHEMA, 'document' => $document,
                'thumb_path' => null, 'thumb_bytes' => 0, 'thumb_stale' => true, 'version' => 1,
            ]);
            $checked = TemplateDocument::check($document, false);
            TemplateUsages::sync($block, $checked->assetIds(), $checked->fontIds());
            $blockMap[$item['id']] = $block->id;
        }

        $templateMap = [];
        $templateNames = $this->taken(CreatorTemplate::withTrashed()->ownedBy($this->userId)->where('section', $this->section)->pluck('name')->all());
        foreach ($package->items('templates') as $item) {
            $document = TransferPackage::remap($item['document'], $assetMap, $fontMap, $blockMap);
            $template = CreatorTemplate::create([
                'user_id' => $this->userId, 'section' => $this->section, 'name' => $this->uniqueName('template', $item['name'], $templateNames, TransferPackage::MAX_NAME),
                'width' => $item['width'], 'height' => $item['height'], 'schema_version' => TemplateDocument::SCHEMA, 'document' => $document,
                'output_format' => $item['output_format'], 'output_quality' => $item['output_quality'], 'caption_template' => $item['caption_template'],
                'thumb_path' => null, 'thumb_bytes' => 0, 'thumb_stale' => true, 'version' => 1,
            ]);
            $checked = TemplateDocument::check($document);
            TemplateUsages::sync($template, $checked->assetIds(), $checked->fontIds(), $checked->blockIds());
            $templateMap[$item['id']] = $template->id;
        }

        $setNames = $this->taken(CreatorSet::withTrashed()->ownedBy($this->userId)->where('section', $this->section)->pluck('name')->all());
        foreach ($package->items('sets') as $item) {
            $set = CreatorSet::create([
                'user_id' => $this->userId, 'section' => $this->section,
                'name' => $this->uniqueName('set', $item['name'], $setNames, TransferPackage::MAX_NAME), 'caption_template' => $item['caption_template'],
            ]);
            $rows = [];
            foreach ($item['template_ids'] as $position => $id) {
                $rows[$templateMap[$id]] = ['position' => $position];
            }
            $set->templates()->sync($rows);
        }

        return [
            'templates'    => count($templateMap),
            'blocks'       => count($blockMap),
            'sets'         => count($package->items('sets')),
            'assets'       => count($assetMap),
            'fonts'        => $newFonts,
            'fonts_reused' => count($fontPlan) - $newFonts,
            'renamed'      => array_slice($this->renamed, 0, self::MAX_RENAMED),
            'template_ids' => array_values($templateMap),
            'block_ids'    => array_values($blockMap),
        ];
    }

    /**
     * @description Stores a new file of the account (remembered for the clean-up of a failure).
     * @param string $kind Sub-folder (WorkspaceFiles::newPath()).
     * @param string $extension
     * @param string $content
     * @return string Path.
     */
    private function put(string $kind, string $extension, string $content): string
    {
        $path = WorkspaceFiles::newPath($this->userId, $kind, $extension);
        $this->stored[] = $path;
        WorkspaceFiles::put($path, $content);

        return $path;
    }

    /**
     * @description Taken names as a set of lower-case keys.
     * @param string[] $names
     * @return array<string, true>
     */
    private function taken(array $names): array
    {
        $taken = [];
        foreach ($names as $name) {
            $taken[mb_strtolower(trim($name))] = true;
        }

        return $taken;
    }

    /**
     * @description A free name: the name itself, or the name with ` (n)` (n ≥ 2, a trailing
     *   ` (n)` of the name is replaced) shortened to the longest name; the result is taken.
     * @param string $type Kind of the item (for the list of renamed items).
     * @param string $name Name in the package.
     * @param array<string, true> $taken Taken names (lower case) - the new name is added.
     * @param int $max Longest name.
     * @return string
     */
    private function uniqueName(string $type, string $name, array &$taken, int $max): string
    {
        $name = trim($name);
        $candidate = $name;
        if (isset($taken[mb_strtolower($candidate)])) {
            $base = (string) preg_replace('/ \(\d+\)$/u', '', $name);
            for ($n = 2; isset($taken[mb_strtolower($candidate)]); $n++) {
                $suffix = " ({$n})";
                $candidate = rtrim(mb_substr($base, 0, $max - mb_strlen($suffix))) . $suffix;
            }
            $this->rename($type, $name, $candidate);
        }
        $taken[mb_strtolower($candidate)] = true;

        return $candidate;
    }

    /**
     * @description Remembers an item imported under another name.
     * @param string $type template | block | set | asset | font.
     * @param string $from
     * @param string $to
     * @return void
     */
    private function rename(string $type, string $from, string $to): void
    {
        $this->renamed[] = ['type' => $type, 'from' => $from, 'to' => $to];
    }

    /**
     * @description Key of a font face (family case-insensitive).
     * @param string $family
     * @param int $weight
     * @param string $style
     * @return string
     */
    private static function face(string $family, int $weight, string $style): string
    {
        return mb_strtolower($family) . "|{$weight}|{$style}";
    }
}
