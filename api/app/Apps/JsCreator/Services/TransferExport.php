<?php
/**
 * @file TransferExport.php
 * @path app/Apps/JsCreator/Services/TransferExport.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Builds the export package (TransferPackage) of a selection of own templates, blocks
 *   and sets of a section. Everything the selection needs goes with it: the templates of the
 *   selected sets (not those in the trash), the blocks of the templates, the images / own icons
 *   and own fonts of all documents (files as base64). The package holds nothing about the
 *   account (no user ids, e-mails, folders, thumbnails or outputs).
 * @usage `$package = TransferExport::build($userId, 'images', [1, 2], [], [5]);`
 * @dependencies TransferPackage, TemplateDocument, the models of the workspace, WorkspaceFiles (disk).
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorSet;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Support\TemplateDocument;
use App\Apps\JsCreator\Support\TransferPackage;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

final class TransferExport
{
    /**
     * @description Package of the selection.
     * @param int $userId Owner.
     * @param string $section Section of the selection.
     * @param int[] $templateIds Selected templates.
     * @param int[] $blockIds Selected blocks.
     * @param int[] $setIds Selected sets.
     * @return array{package: array<string, mixed>, counts: array<string, int>} The package and the number of its items.
     * @throws InvalidPackageException A selected item is not own (or in the trash), a file of the
     *   workspace is missing, or the package is over the limits of an import.
     */
    public static function build(int $userId, string $section, array $templateIds, array $blockIds, array $setIds): array
    {
        $errors = [];
        $sets = CreatorSet::query()->ownedBy($userId)->where('section', $section)->whereIn('id', $setIds)->with('templates')->get();
        self::missing($setIds, $sets, 'set_ids', $errors);
        $templates = CreatorTemplate::query()->ownedBy($userId)->where('section', $section)->whereIn('id', $templateIds)->get();
        self::missing($templateIds, $templates, 'template_ids', $errors);
        $blocks = CreatorBlock::query()->ownedBy($userId)->where('section', $section)->whereIn('id', $blockIds)->get();
        self::missing($blockIds, $blocks, 'block_ids', $errors);
        if ($errors !== []) {
            throw new InvalidPackageException($errors);
        }

        // Own templates of the sets (the trashed ones stay out - and out of the exported set).
        $setTemplates = $sets->flatMap(fn (CreatorSet $set) => $set->templates->filter(fn (CreatorTemplate $t) => !$t->trashed() && $t->user_id === $userId));
        $templates = $templates->concat($setTemplates)->unique('id')->values();

        // Blocks the templates use (instances).
        $used = $templates->flatMap(fn (CreatorTemplate $t) => TemplateDocument::check($t->document)->blockIds())->unique()->all();
        $blocks = $blocks->concat(CreatorBlock::withTrashed()->ownedBy($userId)->where('section', $section)->whereIn('id', $used)->get())->unique('id')->values();
        self::missing($used, $blocks, 'missing', $errors);

        // Images and fonts of every document.
        $assetIds = [];
        $fontIds = [];
        foreach ([...$templates->all(), ...$blocks->all()] as $item) {
            $checked = TemplateDocument::check($item->document, $item instanceof CreatorTemplate);
            array_push($assetIds, ...$checked->assetIds());
            array_push($fontIds, ...$checked->fontIds());
        }
        $assetIds = array_values(array_unique($assetIds));
        $fontIds = array_values(array_unique($fontIds));
        $assets = CreatorAsset::withTrashed()->ownedBy($userId)->whereIn('id', $assetIds)->get();
        self::missing($assetIds, $assets, 'missing', $errors);
        $fonts = CreatorFont::query()->ownedBy($userId)->whereIn('id', $fontIds)->get();
        self::missing($fontIds, $fonts, 'missing', $errors);

        $limits = [
            'templates' => [$templates, TransferPackage::MAX_TEMPLATES], 'blocks' => [$blocks, TransferPackage::MAX_BLOCKS],
            'sets' => [$sets, TransferPackage::MAX_SETS], 'assets' => [$assets, TransferPackage::MAX_ASSETS], 'fonts' => [$fonts, TransferPackage::MAX_FONTS],
        ];
        if ($errors !== []) {
            throw new InvalidPackageException($errors);
        }
        foreach ($limits as $key => [$items, $max]) {
            if ($items->count() > $max) {
                $errors[$key] = "At most {$max} items in one file.";
            }
        }
        if ($errors !== []) {
            throw new InvalidPackageException($errors, 'export_too_large');
        }

        $templateIdsOut = $templates->pluck('id')->all();
        $package = [
            'format'      => TransferPackage::FORMAT,
            'version'     => TransferPackage::VERSION,
            'section'     => $section,
            'exported_at' => now()->toIso8601String(),
            'templates'   => $templates->map(fn (CreatorTemplate $t) => [
                'id' => $t->id, 'name' => $t->name, 'width' => $t->width, 'height' => $t->height, 'output_format' => $t->output_format,
                'output_quality' => $t->output_quality, 'caption_template' => $t->caption_template, 'document' => $t->document,
            ])->all(),
            'blocks'      => $blocks->map(fn (CreatorBlock $b) => [
                'id' => $b->id, 'name' => $b->name, 'width' => $b->width, 'height' => $b->height, 'document' => $b->document,
            ])->all(),
            'sets'        => $sets->map(fn (CreatorSet $s) => [
                'name' => $s->name, 'caption_template' => $s->caption_template,
                'template_ids' => $s->templates->pluck('id')->filter(fn (int $id) => in_array($id, $templateIdsOut, true))->values()->all(),
            ])->all(),
            'assets'      => [],
            'fonts'       => [],
        ];
        foreach ($assets as $a) {
            $package['assets'][] = [
                'id' => $a->id, 'kind' => $a->kind ?? CreatorAsset::KIND_IMAGE, 'name' => $a->name, 'mime' => $a->mime, 'data' => self::file($a->path, "assets.{$a->id}", $errors),
            ];
        }
        foreach ($fonts as $f) {
            $package['fonts'][] = [
                'id' => $f->id, 'family' => $f->family, 'weight' => $f->weight, 'style' => $f->style, 'format' => $f->format, 'data' => self::file($f->path, "fonts.{$f->id}", $errors),
            ];
        }
        if ($errors !== []) {
            throw new InvalidPackageException($errors);
        }
        if (strlen((string) json_encode($package, TemplateDocument::JSON_FLAGS)) > TransferPackage::MAX_BYTES) {
            throw new InvalidPackageException(['package' => 'The file would be larger than ' . (TransferPackage::MAX_BYTES / 1024 / 1024) . ' MB.'], 'export_too_large');
        }

        return ['package' => $package, 'counts' => array_map(fn (array $pair) => $pair[0]->count(), $limits)];
    }

    /**
     * @description Records the requested ids that were not found.
     * @param int[] $ids Requested ids.
     * @param Collection<int, object> $found Found items.
     * @param string $key Key of the error (`missing` = a dependency of the documents).
     * @param array<string, string> $errors
     * @return void
     */
    private static function missing(array $ids, Collection $found, string $key, array &$errors): void
    {
        if (array_diff($ids, $found->pluck('id')->all()) !== []) {
            $errors[$key] = $key === 'missing'
                ? 'An image, font or block of the templates is missing in your workspace.'
                : 'An item is not among your items (or it is in the trash).';
        }
    }

    /**
     * @description Content of a file of the workspace as base64.
     * @param string $path Path on the private disk.
     * @param string $key Key of the error.
     * @param array<string, string> $errors
     * @return string Base64 ('' when the file is missing - an error is recorded).
     */
    private static function file(string $path, string $key, array &$errors): string
    {
        $content = Storage::disk(WorkspaceFiles::DISK)->get($path);
        if ($content === null || $content === '') {
            $errors[$key] = 'A file of the workspace is missing.';

            return '';
        }

        return base64_encode($content);
    }
}
