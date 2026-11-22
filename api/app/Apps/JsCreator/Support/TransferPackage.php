<?php
/**
 * @file TransferPackage.php
 * @path app/Apps/JsCreator/Support/TransferPackage.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shape of the export / import file of JS Creator (format `js-creator`, version 1)
 *   and its strict validation. A package carries templates, blocks and sets of one section with
 *   everything they need - the library images / own icons and own fonts their documents use
 *   (files as base64) - and nothing about the account (no user ids, e-mails or folders):
 *   {
 *     format: "js-creator", version: 1, section: "images", exported_at: ISO 8601,
 *     templates: [{ id, name, width, height, output_format, output_quality, caption_template, document }],
 *     blocks:    [{ id, name, width, height, document }],
 *     sets:      [{ name, caption_template, template_ids: [template id of the package] }],
 *     assets:    [{ id, kind: image|icon, name, mime, data }],
 *     fonts:     [{ id, family, weight, style, format, data }]
 *   }
 *   Ids are ids of the package only (the ids of the exporting account); documents reference them
 *   (image sources, `user:<font id>`, block instances) and the import maps them to new ids.
 *   check() refuses an unknown or missing key, a wrong type or range, a document refused by
 *   TemplateDocument, a reference outside of the package and conflicting fields of a set.
 *   The files (images, fonts) are checked by TransferImport (decoding them is expensive).
 * @usage `$package = TransferPackage::check($decoded, 'images'); if ($package->errors()) …`
 * @dependencies TemplateDocument, EffectiveFields, TemplateSize, CreatorAsset, CreatorFont, CreatorSet.
 */

namespace App\Apps\JsCreator\Support;

use App\Apps\JsCreator\Http\Requests\UpdateTemplateRequest;
use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorSet;

final class TransferPackage
{
    /** @description Value of `format`. */
    public const FORMAT = 'js-creator';

    /** @description Current version of the package. */
    public const VERSION = 1;

    /** @description Most templates of one package. */
    public const MAX_TEMPLATES = 100;

    /** @description Most blocks of one package. */
    public const MAX_BLOCKS = 100;

    /** @description Most sets of one package. */
    public const MAX_SETS = 20;

    /** @description Most images / icons of one package. */
    public const MAX_ASSETS = 100;

    /** @description Most fonts of one package. */
    public const MAX_FONTS = 20;

    /** @description Largest package (bytes of the JSON) - the limit of the upload profile js_creator_import. */
    public const MAX_BYTES = 20 * 1024 * 1024;

    /** @description At most this many errors are reported. */
    public const MAX_ERRORS = 20;

    /** @description Longest name of a template, block or set / of an image / of a font family. */
    public const MAX_NAME = 120;
    public const MAX_ASSET_NAME = 150;
    public const MAX_FAMILY = 80;

    /** @description Allowed types of the images of a package (own icons: PNG / JPEG only). */
    public const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    /** @description Keys of the package and of its items. */
    private const KEYS = [
        'root'     => ['format', 'version', 'section', 'exported_at', 'templates', 'blocks', 'sets', 'assets', 'fonts'],
        'template' => ['id', 'name', 'width', 'height', 'output_format', 'output_quality', 'caption_template', 'document'],
        'block'    => ['id', 'name', 'width', 'height', 'document'],
        'set'      => ['name', 'caption_template', 'template_ids'],
        'asset'    => ['id', 'kind', 'name', 'mime', 'data'],
        'font'     => ['id', 'family', 'weight', 'style', 'format', 'data'],
    ];

    /** @var array<string, string> Path → message. */
    private array $errors = [];

    /** @var array<string, mixed> The checked package. */
    private array $package = [];

    private function __construct()
    {
    }

    /**
     * @description Validates a decoded package of a section.
     * @param mixed $data Decoded JSON of the file.
     * @param string $section Section of the import (must be the section of the package).
     * @return self Result (errors(), templates(), blocks(), sets(), assets(), fonts()).
     */
    public static function check(mixed $data, string $section): self
    {
        $result = new self();
        $result->root($data, $section);

        return $result;
    }

    /**
     * @description Found errors (path → message), at most MAX_ERRORS.
     * @return array<string, string>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * @description Items of the checked package (only when errors() is empty).
     * @param string $key templates | blocks | sets | assets | fonts.
     * @return list<array<string, mixed>>
     */
    public function items(string $key): array
    {
        return $this->package[$key] ?? [];
    }

    /**
     * @description A document with the ids of the package replaced by the new ids: image
     *   sources (`assetId`), own fonts (`family` `user:<id>`) and block instances (`blockId`).
     *   Only these keys hold ids in a valid document (TemplateDocument), so a walk over the whole
     *   document changes nothing else.
     * @param array<string, mixed> $document Checked document.
     * @param array<int, int> $assets Package id → new id of the images.
     * @param array<int, int> $fonts Package id → new id of the fonts.
     * @param array<int, int> $blocks Package id → new id of the blocks.
     * @return array<string, mixed>
     */
    public static function remap(array $document, array $assets, array $fonts, array $blocks): array
    {
        $walk = function (array $node) use (&$walk, $assets, $fonts, $blocks): array {
            foreach ($node as $key => $value) {
                if (is_array($value)) {
                    $node[$key] = $walk($value);
                } elseif ($key === 'assetId' && is_int($value) && isset($assets[$value])) {
                    $node[$key] = $assets[$value];
                } elseif ($key === 'blockId' && is_int($value) && isset($blocks[$value])) {
                    $node[$key] = $blocks[$value];
                } elseif ($key === 'family' && is_string($value) && str_starts_with($value, 'user:') && isset($fonts[(int) substr($value, 5)])) {
                    $node[$key] = 'user:' . $fonts[(int) substr($value, 5)];
                }
            }

            return $node;
        };

        return $walk($document);
    }

    /**
     * @description Root of the package.
     * @param mixed $data
     * @param string $section
     * @return void
     */
    private function root(mixed $data, string $section): void
    {
        $root = $this->object($data, 'package', self::KEYS['root']);
        if ($root === null) {
            return;
        }
        if ($root['format'] !== self::FORMAT) {
            $this->error('format', 'This is not a file of JS Creator.');
        }
        if ($root['version'] !== self::VERSION) {
            $this->error('version', 'Unsupported version of the file.');
        }
        if ($root['section'] !== $section) {
            $this->error('section', 'The file belongs to another section.');
        }
        if (!is_string($root['exported_at']) || strlen($root['exported_at']) > 40) {
            $this->error('exported_at', 'Invalid date of the export.');
        }
        if ($this->errors !== []) {
            return;
        }

        $limits = ['templates' => self::MAX_TEMPLATES, 'blocks' => self::MAX_BLOCKS, 'sets' => self::MAX_SETS, 'assets' => self::MAX_ASSETS, 'fonts' => self::MAX_FONTS];
        foreach ($limits as $key => $max) {
            if (!is_array($root[$key]) || !array_is_list($root[$key])) {
                $this->error($key, 'Must be a list.');
            } elseif (count($root[$key]) > $max) {
                $this->error($key, "At most {$max} items.");
            }
        }
        if ($this->errors !== []) {
            return;
        }
        if ($root['templates'] === [] && $root['blocks'] === [] && $root['sets'] === []) {
            $this->error('package', 'The file contains no templates, blocks or sets.');

            return;
        }

        $assets = $this->list($root['assets'], 'assets', 'asset', fn (array $a, string $p) => $this->asset($a, $p));
        $fonts = $this->list($root['fonts'], 'fonts', 'font', fn (array $f, string $p) => $this->font($f, $p));
        $blocks = $this->list($root['blocks'], 'blocks', 'block', fn (array $b, string $p) => $this->design($b, $p, false));
        $templates = $this->list($root['templates'], 'templates', 'template', fn (array $t, string $p) => $this->design($t, $p, true));
        $sets = $this->list($root['sets'], 'sets', 'set', fn (array $s, string $p) => $this->setBasics($s, $p));
        if ($this->errors !== []) {
            return;
        }

        $assetIds = $this->ids($assets, 'assets');
        $fontIds = $this->ids($fonts, 'fonts');
        $blockIds = $this->ids($blocks, 'blocks');
        $templateIds = $this->ids($templates, 'templates');
        if ($this->errors !== []) {
            return;
        }

        foreach (['blocks' => $blocks, 'templates' => $templates] as $key => $items) {
            foreach ($items as $i => $item) {
                $checked = TemplateDocument::check($item['document'], $key === 'templates');
                foreach ($checked->errors() as $path => $message) {
                    $this->error("{$key}.{$i}.{$path}", $message);
                }
                if ($checked->errors() !== []) {
                    continue;
                }
                foreach (array_diff($checked->assetIds(), $assetIds) as $id) {
                    $this->error("{$key}.{$i}." . $checked->pathOf('asset', $id), 'The image is not in the file.');
                }
                foreach (array_diff($checked->fontIds(), $fontIds) as $id) {
                    $this->error("{$key}.{$i}." . $checked->pathOf('font', $id), 'The font is not in the file.');
                }
                foreach (array_diff($checked->blockIds(), $blockIds) as $id) {
                    $this->error("{$key}.{$i}." . $checked->pathOf('block', $id), 'The block is not in the file.');
                }
            }
        }
        if ($this->errors !== []) {
            return;
        }

        $blockDocs = array_column($blocks, 'document', 'id');
        $templateDocs = array_column($templates, 'document', 'id');
        foreach ($sets as $i => $set) {
            $seen = [];
            foreach ($set['template_ids'] as $j => $id) {
                if (!in_array($id, $templateIds, true)) {
                    $this->error("sets.{$i}.template_ids.{$j}", 'The template is not in the file.');
                    continue;
                }
                foreach (EffectiveFields::types($templateDocs[$id], $blockDocs) as $key => $type) {
                    $first = $seen[$key] ??= $type;
                    if ($first !== $type) {
                        $this->error("sets.{$i}.template_ids.{$j}", "The field \"{$key}\" is of another kind than in another template of the set.");
                    }
                }
            }
        }
        if ($this->errors === []) {
            $this->package = compact('templates', 'blocks', 'sets', 'assets', 'fonts');
        }
    }

    /**
     * @description A list of items, each an object with exactly the keys of its kind.
     * @param list<mixed> $values
     * @param string $path
     * @param string $kind Key of KEYS.
     * @param callable(array<string, mixed>, string): void $check Further checks of an item.
     * @return list<array<string, mixed>>
     */
    private function list(array $values, string $path, string $kind, callable $check): array
    {
        $items = [];
        foreach ($values as $i => $value) {
            $item = $this->object($value, "{$path}.{$i}", self::KEYS[$kind]);
            if ($item !== null) {
                $check($item, "{$path}.{$i}");
                $items[] = $item;
            }
        }

        return $items;
    }

    /**
     * @description Ids of the items of a list (positive integers, unique).
     * @param list<array<string, mixed>> $items
     * @param string $path
     * @return int[]
     */
    private function ids(array $items, string $path): array
    {
        $ids = array_column($items, 'id');
        foreach (array_diff_assoc($ids, array_unique($ids)) as $i => $id) {
            $this->error("{$path}.{$i}.id", 'The id is used twice.');
        }

        return $ids;
    }

    /**
     * @description A template (with output settings) or a block: id, name, size; the document
     *   is checked later (it needs the ids of the package).
     * @param array<string, mixed> $item
     * @param string $path
     * @param bool $template
     * @return void
     */
    private function design(array $item, string $path, bool $template): void
    {
        $this->id($item['id'], "{$path}.id");
        $this->name($item['name'], "{$path}.name", self::MAX_NAME);
        foreach (['width', 'height'] as $side) {
            if (!is_int($item[$side]) || $item[$side] < TemplateSize::MIN || $item[$side] > TemplateSize::MAX) {
                $this->error("{$path}.{$side}", 'Size between ' . TemplateSize::MIN . ' and ' . TemplateSize::MAX . ' px.');
            }
        }
        if (!is_array($item['document'])) {
            $this->error("{$path}.document", 'Must be an object.');
        }
        if ($template) {
            if (!in_array($item['output_format'], ['png', 'jpg'], true)) {
                $this->error("{$path}.output_format", 'PNG or JPG.');
            }
            if (!is_int($item['output_quality']) || $item['output_quality'] < 1 || $item['output_quality'] > 100) {
                $this->error("{$path}.output_quality", 'Quality between 1 and 100.');
            }
            $this->caption($item['caption_template'], "{$path}.caption_template");
        }
    }

    /**
     * @description A set: name, caption pattern and ids of its templates (checked against the
     *   package later).
     * @param array<string, mixed> $item
     * @param string $path
     * @return void
     */
    private function setBasics(array $item, string $path): void
    {
        $this->name($item['name'], "{$path}.name", self::MAX_NAME);
        $this->caption($item['caption_template'], "{$path}.caption_template");
        $ids = $item['template_ids'];
        if (!is_array($ids) || !array_is_list($ids) || count($ids) > CreatorSet::MAX_TEMPLATES) {
            $this->error("{$path}.template_ids", 'A list of at most ' . CreatorSet::MAX_TEMPLATES . ' templates.');

            return;
        }
        foreach ($ids as $j => $id) {
            $this->id($id, "{$path}.template_ids.{$j}");
        }
        if (count(array_unique(array_filter($ids, 'is_int'))) !== count($ids)) {
            $this->error("{$path}.template_ids", 'A template is in the set twice.');
        }
    }

    /**
     * @description An image / own icon: id, kind, name, type and base64 data.
     * @param array<string, mixed> $item
     * @param string $path
     * @return void
     */
    private function asset(array $item, string $path): void
    {
        $this->id($item['id'], "{$path}.id");
        if (!in_array($item['kind'], CreatorAsset::KINDS, true)) {
            $this->error("{$path}.kind", 'Unknown kind of image.');
        }
        $this->name($item['name'], "{$path}.name", self::MAX_ASSET_NAME);
        $mimes = $item['kind'] === CreatorAsset::KIND_ICON ? ['image/png', 'image/jpeg'] : self::MIMES;
        if (!in_array($item['mime'], $mimes, true)) {
            $this->error("{$path}.mime", 'Unsupported type of image.');
        }
        $this->base64($item['data'], "{$path}.data");
    }

    /**
     * @description An own font: id, face (family, weight, style), format and base64 data.
     * @param array<string, mixed> $item
     * @param string $path
     * @return void
     */
    private function font(array $item, string $path): void
    {
        $this->id($item['id'], "{$path}.id");
        if (!is_string($item['family']) || mb_strlen($item['family']) > self::MAX_FAMILY || !preg_match('/^[\pL\pN][\pL\pN \-_.\']*$/u', $item['family'])) {
            $this->error("{$path}.family", 'Invalid name of the font family.');
        }
        if (!in_array($item['weight'], CreatorFont::WEIGHTS, true)) {
            $this->error("{$path}.weight", 'Invalid weight.');
        }
        if (!in_array($item['style'], CreatorFont::STYLES, true)) {
            $this->error("{$path}.style", 'Invalid style.');
        }
        if (!in_array($item['format'], FontFile::EXTENSIONS, true)) {
            $this->error("{$path}.format", 'Unsupported format of font.');
        }
        $this->base64($item['data'], "{$path}.data");
    }

    /**
     * @description Id of the package: a positive integer.
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function id(mixed $value, string $path): void
    {
        if (!is_int($value) || $value < 1) {
            $this->error($path, 'Must be a positive integer.');
        }
    }

    /**
     * @description Name: 1 … max characters, no control characters.
     * @param mixed $value
     * @param string $path
     * @param int $max
     * @return void
     */
    private function name(mixed $value, string $path, int $max): void
    {
        if (!is_string($value) || trim($value) === '' || mb_strlen($value) > $max || preg_match('/[\x00-\x1F\x7F]/', $value)) {
            $this->error($path, "Name of 1 to {$max} characters.");
        }
    }

    /**
     * @description Caption pattern: null or text (line breaks allowed).
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function caption(mixed $value, string $path): void
    {
        if ($value !== null && (!is_string($value) || mb_strlen($value) > UpdateTemplateRequest::MAX_CAPTION || preg_match('/[\x00-\x09\x0B-\x1F\x7F]/', $value))) {
            $this->error($path, 'Text of at most ' . UpdateTemplateRequest::MAX_CAPTION . ' characters.');
        }
    }

    /**
     * @description Data of a file: strict base64 (the content is checked on import).
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function base64(mixed $value, string $path): void
    {
        if (!is_string($value) || $value === '' || !preg_match('/^[A-Za-z0-9+\/]+={0,2}$/', $value) || strlen($value) % 4 !== 0) {
            $this->error($path, 'Invalid data of the file.');
        }
    }

    /**
     * @description An object with exactly the given keys.
     * @param mixed $value
     * @param string $path
     * @param string[] $keys
     * @return array<string, mixed>|null The object, or null when it is not one.
     */
    private function object(mixed $value, string $path, array $keys): ?array
    {
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            $this->error($path, 'Must be an object.');

            return null;
        }
        foreach (array_diff(array_keys($value), $keys) as $unknown) {
            $this->error("{$path}.{$unknown}", 'Unknown property.');
        }
        foreach (array_diff($keys, array_keys($value)) as $missing) {
            $this->error("{$path}.{$missing}", 'Missing property.');
        }

        return count(array_intersect(array_keys($value), $keys)) === count($keys) ? $value : null;
    }

    /**
     * @description Records an error (the first MAX_ERRORS).
     * @param string $path
     * @param string $message
     * @return void
     */
    private function error(string $path, string $message): void
    {
        if (count($this->errors) < self::MAX_ERRORS && !isset($this->errors[$path])) {
            $this->errors[$path] = $message;
        }
    }
}
