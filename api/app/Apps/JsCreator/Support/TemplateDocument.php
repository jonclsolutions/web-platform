<?php
/**
 * @file TemplateDocument.php
 * @path app/Apps/JsCreator/Support/TemplateDocument.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Strict validation of the document of a template (schema version 1) - the JSON the
 *   editor saves and the renderer of the browser draws. Everything is checked: the kinds of
 *   layers and their properties, ranges of numbers, lengths of texts (plain text, never HTML),
 *   colours, the number of layers and fields, the size of the JSON; an unknown or missing
 *   property is refused. Field references must point to a field of the right kind; library
 *   images, own fonts and blocks (instances, templates only - blocks do not nest) are collected
 *   (assetIds(), fontIds(), blockIds()) for the ownership check of the controller and the usage
 *   table.
 * @usage `$doc = TemplateDocument::check($input); if ($doc->errors()) …; $doc->assetIds()`;
 *   a block: `TemplateDocument::check($input, false)`.
 * @note The same shape is in the frontend: apps/js-creator/admin/shared/render/document.ts
 *   (types, defaults, limits). A new property = both places + the schema test of both sides.
 *   Shape of the document:
 *   { schema: 1, fields: Field[], pages: [{ background, layers: Layer[] }] } (one page now -
 *   carousels later).
 */

namespace App\Apps\JsCreator\Support;

final class TemplateDocument
{
    /** @description Current schema version of the document. */
    public const SCHEMA = 1;

    /** @description Largest JSON of a document (bytes). */
    public const MAX_BYTES = 1_048_576;

    /** @description Most layers of one page. */
    public const MAX_LAYERS = 200;

    /** @description Most fields of a template. */
    public const MAX_FIELDS = 50;

    /** @description Longest text of a layer / sample of a field. */
    public const MAX_TEXT = 2000;

    /** @description Flags of the stored JSON (and of its size check) - UTF-8 as the browser sends it. */
    public const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /** @description Pages of a document (carousels later). */
    public const MAX_PAGES = 1;

    /** @description Anchors of a layer: top / middle / bottom × left / center / right. */
    public const ANCHORS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

    /** @description Layouts of an image grid with their number of cells. */
    public const GRID_LAYOUTS = [
        '2x1' => 2, '1x2' => 2, '2x2' => 4, '3x1' => 3, '1x3' => 3, '3x2' => 6, '2x3' => 6, '3x3' => 9,
        '1+2' => 3, '2+1' => 3, '1+3' => 4, '3+1' => 4,
    ];

    /** @description Properties of every layer. */
    private const COMMON = ['id', 'type', 'name', 'anchor', 'x', 'y', 'w', 'h', 'rotation', 'opacity', 'hidden', 'locked'];

    /** @description Further properties of each kind of layer. */
    private const LAYER_KEYS = [
        'text'  => ['field', 'text', 'font', 'size', 'fill', 'lineHeight', 'letterSpacing', 'align', 'valign', 'uppercase',
            'maxLines', 'autoShrink', 'minSize', 'overflow', 'stroke', 'shadow', 'box', 'highlight'],
        'image' => ['source', 'fit', 'focusX', 'focusY', 'radius', 'mask', 'border', 'shadow', 'overlay', 'flipX'],
        'grid'  => ['layout', 'gap', 'radius', 'fit', 'cells', 'border', 'overlay'],
        'shape' => ['shape', 'fill', 'radius', 'stroke', 'shadow'],
        'icon'  => ['icon', 'color', 'strokeWidth', 'shadow'],
        'block' => ['blockId', 'scale'],
    ];

    /** @description Smallest / largest scale of a block instance. */
    public const BLOCK_SCALE = [0.05, 20];

    /** @description At most this many errors are reported. */
    private const MAX_ERRORS = 20;

    /** @var array<string, string> Path → message. */
    private array $errors = [];

    /** @var array<string, string> Field key → kind (text | image). */
    private array $fields = [];

    /** @var array<int, string> Library image id → path of its first use. */
    private array $assets = [];

    /** @var array<int, string> Own font id → path of its first use. */
    private array $fonts = [];

    /** @var array<int, string> Block id → path of its first instance. */
    private array $blocks = [];

    /** @var array<string, true> Layer ids already seen. */
    private array $layerIds = [];

    /**
     * @param bool $allowBlocks Block instances are allowed (a template; never a block).
     */
    private function __construct(private readonly bool $allowBlocks)
    {
    }

    /**
     * @description Validates a document.
     * @param mixed $document Decoded JSON of the request.
     * @param bool $allowBlocks Document of a template (true) or of a block (false - no instances).
     * @return self Result (errors(), assetIds(), fontIds(), blockIds()).
     */
    public static function check(mixed $document, bool $allowBlocks = true): self
    {
        $result = new self($allowBlocks);
        $json = json_encode($document, self::JSON_FLAGS);
        if ($json === false || strlen($json) > self::MAX_BYTES) {
            $result->error('document', 'The document is too large (at most 1 MB).');

            return $result;
        }
        $result->document($document);

        return $result;
    }

    /**
     * @description An empty document: white background (a block: transparent), no layers, no fields.
     * @param bool $transparent Transparent background (a block shows the template under it).
     * @return array<string, mixed>
     */
    public static function empty(bool $transparent = false): array
    {
        $color = $transparent ? '#ffffff00' : '#ffffff';

        return [
            'schema' => self::SCHEMA,
            'fields' => [],
            'pages'  => [['background' => ['fill' => ['type' => 'solid', 'color' => $color], 'image' => null], 'layers' => []]],
        ];
    }

    /**
     * @description Found errors, keyed by the path of the property (e.g. `document.pages.0.layers.2.size`).
     * @return array<string, string>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * @description Ids of the library images the document uses.
     * @return int[]
     */
    public function assetIds(): array
    {
        return array_keys($this->assets);
    }

    /**
     * @description Ids of the own fonts the document uses.
     * @return int[]
     */
    public function fontIds(): array
    {
        return array_keys($this->fonts);
    }

    /**
     * @description Ids of the blocks the document uses (instances).
     * @return int[]
     */
    public function blockIds(): array
    {
        return array_keys($this->blocks);
    }

    /**
     * @description Path of the first use of an image / font / block (for an error message).
     * @param string $kind `asset` | `font` | `block`.
     * @param int $id Id.
     * @return string
     */
    public function pathOf(string $kind, int $id): string
    {
        return match ($kind) {
            'asset' => $this->assets[$id] ?? null,
            'font'  => $this->fonts[$id] ?? null,
            default => $this->blocks[$id] ?? null,
        } ?? 'document';
    }

    /**
     * @description Root of the document.
     * @param mixed $value
     * @return void
     */
    private function document(mixed $value): void
    {
        $doc = $this->object($value, 'document', ['schema', 'fields', 'pages']);
        if ($doc === null) {
            return;
        }
        if ($doc['schema'] !== self::SCHEMA) {
            $this->error('document.schema', 'Unsupported schema version.');

            return;
        }
        $fields = $this->list($doc['fields'], 'document.fields', 0, self::MAX_FIELDS);
        foreach ($fields ?? [] as $i => $field) {
            $this->field($field, "document.fields.{$i}");
        }
        $pages = $this->list($doc['pages'], 'document.pages', 1, self::MAX_PAGES);
        foreach ($pages ?? [] as $i => $page) {
            $this->page($page, "document.pages.{$i}");
        }
    }

    /**
     * @description Field to fill in when generating (text or image).
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function field(mixed $value, string $path): void
    {
        $type = is_array($value) ? ($value['type'] ?? null) : null;
        $keys = match ($type) {
            'text'  => ['key', 'type', 'label', 'help', 'required', 'sample', 'maxLength', 'multiline'],
            'image' => ['key', 'type', 'label', 'help', 'required', 'minWidth', 'minHeight'],
            default => null,
        };
        if ($keys === null) {
            $this->error("{$path}.type", 'Unknown kind of field.');

            return;
        }
        $f = $this->object($value, $path, $keys);
        if ($f === null) {
            return;
        }
        if (!is_string($f['key']) || !preg_match('/^[a-z][a-z0-9_]{0,39}$/', $f['key'])) {
            $this->error("{$path}.key", 'The key may contain a-z, 0-9 and _ (at most 40, starting with a letter).');
        } elseif (isset($this->fields[$f['key']])) {
            $this->error("{$path}.key", 'The key is used twice.');
        } else {
            $this->fields[$f['key']] = $type;
        }
        $this->string($f['label'], "{$path}.label", 1, 80);
        $this->string($f['help'], "{$path}.help", 0, 200);
        $this->bool($f['required'], "{$path}.required");
        if ($type === 'text') {
            $this->string($f['sample'], "{$path}.sample", 0, self::MAX_TEXT, true);
            $this->int($f['maxLength'], "{$path}.maxLength", 1, self::MAX_TEXT);
            $this->bool($f['multiline'], "{$path}.multiline");
        } else {
            $this->int($f['minWidth'], "{$path}.minWidth", 0, 10000);
            $this->int($f['minHeight'], "{$path}.minHeight", 0, 10000);
        }
    }

    /**
     * @description One page: background and layers.
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function page(mixed $value, string $path): void
    {
        $page = $this->object($value, $path, ['background', 'layers']);
        if ($page === null) {
            return;
        }
        $background = $this->object($page['background'], "{$path}.background", ['fill', 'image']);
        if ($background !== null) {
            $this->fill($background['fill'], "{$path}.background.fill");
            if ($background['image'] !== null) {
                $image = $this->object($background['image'], "{$path}.background.image", ['source', 'fit', 'focusX', 'focusY', 'overlay']);
                if ($image !== null) {
                    $this->source($image['source'], "{$path}.background.image.source");
                    $this->enum($image['fit'], "{$path}.background.image.fit", ['cover', 'contain']);
                    $this->number($image['focusX'], "{$path}.background.image.focusX", 0, 1);
                    $this->number($image['focusY'], "{$path}.background.image.focusY", 0, 1);
                    $this->nullable($image['overlay'], fn ($v) => $this->fill($v, "{$path}.background.image.overlay"));
                }
            }
        }
        $layers = $this->list($page['layers'], "{$path}.layers", 0, self::MAX_LAYERS);
        foreach ($layers ?? [] as $i => $layer) {
            $this->layer($layer, "{$path}.layers.{$i}");
        }
    }

    /**
     * @description One layer (common properties + those of its kind).
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function layer(mixed $value, string $path): void
    {
        $type = is_array($value) ? ($value['type'] ?? null) : null;
        if (!is_string($type) || !isset(self::LAYER_KEYS[$type])) {
            $this->error("{$path}.type", 'Unknown kind of layer.');

            return;
        }
        $l = $this->object($value, $path, [...self::COMMON, ...self::LAYER_KEYS[$type]]);
        if ($l === null) {
            return;
        }
        if (!is_string($l['id']) || !preg_match('/^[A-Za-z0-9_-]{1,32}$/', $l['id'])) {
            $this->error("{$path}.id", 'Invalid layer id.');
        } elseif (isset($this->layerIds[$l['id']])) {
            $this->error("{$path}.id", 'The layer id is used twice.');
        } else {
            $this->layerIds[$l['id']] = true;
        }
        $this->string($l['name'], "{$path}.name", 0, 80);
        $this->enum($l['anchor'], "{$path}.anchor", self::ANCHORS);
        $this->number($l['x'], "{$path}.x", -20000, 20000);
        $this->number($l['y'], "{$path}.y", -20000, 20000);
        $this->number($l['w'], "{$path}.w", 1, 20000);
        $this->number($l['h'], "{$path}.h", 1, 20000);
        $this->number($l['rotation'], "{$path}.rotation", -360, 360);
        $this->number($l['opacity'], "{$path}.opacity", 0, 1);
        $this->bool($l['hidden'], "{$path}.hidden");
        $this->bool($l['locked'], "{$path}.locked");

        match ($type) {
            'text'  => $this->textLayer($l, $path),
            'image' => $this->imageLayer($l, $path),
            'grid'  => $this->gridLayer($l, $path),
            'shape' => $this->shapeLayer($l, $path),
            'icon'  => $this->iconLayer($l, $path),
            'block' => $this->blockLayer($l, $path),
        };
    }

    /**
     * @description Properties of a text layer.
     * @param array<string, mixed> $l Layer.
     * @param string $path
     * @return void
     */
    private function textLayer(array $l, string $path): void
    {
        if ($l['field'] !== null) {
            $this->fieldRef($l['field'], "{$path}.field", 'text');
        }
        $this->string($l['text'], "{$path}.text", 0, self::MAX_TEXT, true);
        $font = $this->object($l['font'], "{$path}.font", ['family', 'weight', 'style']);
        if ($font !== null) {
            if (!is_string($font['family']) || !preg_match('/^(set:[a-z0-9-]{1,60}|user:[1-9][0-9]{0,11})$/', $font['family'])) {
                $this->error("{$path}.font.family", 'Unknown font.');
            } elseif (str_starts_with($font['family'], 'user:')) {
                $this->fonts[(int) substr($font['family'], 5)] ??= "{$path}.font.family";
            }
            $this->int($font['weight'], "{$path}.font.weight", 100, 900);
            $this->enum($font['style'], "{$path}.font.style", ['normal', 'italic']);
        }
        $this->number($l['size'], "{$path}.size", 4, 1000);
        $this->fill($l['fill'], "{$path}.fill");
        $this->number($l['lineHeight'], "{$path}.lineHeight", 0.5, 4);
        $this->number($l['letterSpacing'], "{$path}.letterSpacing", -100, 500);
        $this->enum($l['align'], "{$path}.align", ['left', 'center', 'right']);
        $this->enum($l['valign'], "{$path}.valign", ['top', 'middle', 'bottom']);
        $this->bool($l['uppercase'], "{$path}.uppercase");
        $this->int($l['maxLines'], "{$path}.maxLines", 0, 100);
        $this->bool($l['autoShrink'], "{$path}.autoShrink");
        $this->number($l['minSize'], "{$path}.minSize", 4, 1000);
        $this->enum($l['overflow'], "{$path}.overflow", ['ellipsis', 'block']);
        $this->nullable($l['stroke'], fn ($v) => $this->stroke($v, "{$path}.stroke", false));
        $this->nullable($l['shadow'], fn ($v) => $this->shadow($v, "{$path}.shadow"));
        $this->nullable($l['box'], function ($v) use ($path) {
            $box = $this->object($v, "{$path}.box", ['fill', 'padding', 'radius', 'fit']);
            if ($box !== null) {
                $this->fill($box['fill'], "{$path}.box.fill");
                $this->number($box['padding'], "{$path}.box.padding", 0, 500);
                $this->number($box['radius'], "{$path}.box.radius", 0, 1000);
                $this->enum($box['fit'], "{$path}.box.fit", ['element', 'text']);
            }
        });
        $highlight = $this->object($l['highlight'], "{$path}.highlight", ['color', 'bold', 'background']);
        if ($highlight !== null) {
            $this->nullable($highlight['color'], fn ($v) => $this->color($v, "{$path}.highlight.color"));
            $this->bool($highlight['bold'], "{$path}.highlight.bold");
            $this->nullable($highlight['background'], fn ($v) => $this->color($v, "{$path}.highlight.background"));
        }
    }

    /**
     * @description Properties of an image layer.
     * @param array<string, mixed> $l Layer.
     * @param string $path
     * @return void
     */
    private function imageLayer(array $l, string $path): void
    {
        $this->source($l['source'], "{$path}.source");
        $this->enum($l['fit'], "{$path}.fit", ['cover', 'contain']);
        $this->number($l['focusX'], "{$path}.focusX", 0, 1);
        $this->number($l['focusY'], "{$path}.focusY", 0, 1);
        $this->number($l['radius'], "{$path}.radius", 0, 10000);
        $this->enum($l['mask'], "{$path}.mask", ['none', 'circle']);
        $this->nullable($l['border'], fn ($v) => $this->stroke($v, "{$path}.border", false));
        $this->nullable($l['shadow'], fn ($v) => $this->shadow($v, "{$path}.shadow"));
        $this->nullable($l['overlay'], fn ($v) => $this->fill($v, "{$path}.overlay"));
        $this->bool($l['flipX'], "{$path}.flipX");
    }

    /**
     * @description Properties of an image grid (the number of cells follows the layout).
     * @param array<string, mixed> $l Layer.
     * @param string $path
     * @return void
     */
    private function gridLayer(array $l, string $path): void
    {
        $this->enum($l['layout'], "{$path}.layout", array_keys(self::GRID_LAYOUTS));
        $this->number($l['gap'], "{$path}.gap", 0, 500);
        $this->number($l['radius'], "{$path}.radius", 0, 10000);
        $this->enum($l['fit'], "{$path}.fit", ['cover', 'contain']);
        $count = is_string($l['layout']) ? (self::GRID_LAYOUTS[$l['layout']] ?? null) : null;
        $cells = $this->list($l['cells'], "{$path}.cells", $count ?? 1, $count ?? 9);
        foreach ($cells ?? [] as $i => $cell) {
            $c = $this->object($cell, "{$path}.cells.{$i}", ['source', 'focusX', 'focusY']);
            if ($c !== null) {
                $this->source($c['source'], "{$path}.cells.{$i}.source");
                $this->number($c['focusX'], "{$path}.cells.{$i}.focusX", 0, 1);
                $this->number($c['focusY'], "{$path}.cells.{$i}.focusY", 0, 1);
            }
        }
        $this->nullable($l['border'], fn ($v) => $this->stroke($v, "{$path}.border", false));
        $this->nullable($l['overlay'], fn ($v) => $this->fill($v, "{$path}.overlay"));
    }

    /**
     * @description Properties of a shape.
     * @param array<string, mixed> $l Layer.
     * @param string $path
     * @return void
     */
    private function shapeLayer(array $l, string $path): void
    {
        $this->enum($l['shape'], "{$path}.shape", ['rect', 'ellipse', 'line']);
        $this->nullable($l['fill'], fn ($v) => $this->fill($v, "{$path}.fill"));
        $this->number($l['radius'], "{$path}.radius", 0, 10000);
        $this->nullable($l['stroke'], fn ($v) => $this->stroke($v, "{$path}.stroke", true));
        $this->nullable($l['shadow'], fn ($v) => $this->shadow($v, "{$path}.shadow"));
    }

    /**
     * @description Properties of an icon of the icon set.
     * @param array<string, mixed> $l Layer.
     * @param string $path
     * @return void
     */
    private function iconLayer(array $l, string $path): void
    {
        if (!is_string($l['icon']) || !preg_match('/^[a-z0-9-]{1,60}$/', $l['icon'])) {
            $this->error("{$path}.icon", 'Unknown icon.');
        }
        $this->color($l['color'], "{$path}.color");
        $this->number($l['strokeWidth'], "{$path}.strokeWidth", 0.25, 4);
        $this->nullable($l['shadow'], fn ($v) => $this->shadow($v, "{$path}.shadow"));
    }

    /**
     * @description Instance of a block (templates only): the block and its scale. The box of the
     *   layer (w, h) follows the size of the block × scale (kept by the editor; the renderer
     *   always uses the current size of the block).
     * @param array<string, mixed> $l Layer.
     * @param string $path
     * @return void
     */
    private function blockLayer(array $l, string $path): void
    {
        if (!$this->allowBlocks) {
            $this->error("{$path}.type", 'A block cannot contain another block.');

            return;
        }
        if ($this->int($l['blockId'], "{$path}.blockId", 1, PHP_INT_MAX)) {
            $this->blocks[$l['blockId']] ??= "{$path}.blockId";
        }
        $this->number($l['scale'], "{$path}.scale", self::BLOCK_SCALE[0], self::BLOCK_SCALE[1]);
    }

    /**
     * @description Source of an image: none, a library image or an image field.
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function source(mixed $value, string $path): void
    {
        $kind = is_array($value) ? ($value['kind'] ?? null) : null;
        $keys = match ($kind) {
            'none'  => ['kind'],
            'asset' => ['kind', 'assetId'],
            'field' => ['kind', 'field'],
            default => null,
        };
        if ($keys === null) {
            $this->error("{$path}.kind", 'Unknown kind of image source.');

            return;
        }
        $s = $this->object($value, $path, $keys);
        if ($s === null) {
            return;
        }
        if ($kind === 'asset' && $this->int($s['assetId'], "{$path}.assetId", 1, PHP_INT_MAX)) {
            $this->assets[$s['assetId']] ??= "{$path}.assetId";
        }
        if ($kind === 'field') {
            $this->fieldRef($s['field'], "{$path}.field", 'image');
        }
    }

    /**
     * @description Reference to a field of the given kind.
     * @param mixed $value Field key.
     * @param string $path
     * @param string $kind text | image.
     * @return void
     */
    private function fieldRef(mixed $value, string $path, string $kind): void
    {
        if (!is_string($value) || ($this->fields[$value] ?? null) !== $kind) {
            $this->error($path, "Unknown {$kind} field.");
        }
    }

    /**
     * @description Fill: a colour or a linear / radial gradient (2-6 stops).
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function fill(mixed $value, string $path): void
    {
        $type = is_array($value) ? ($value['type'] ?? null) : null;
        $keys = match ($type) {
            'solid'  => ['type', 'color'],
            'linear' => ['type', 'angle', 'stops'],
            'radial' => ['type', 'stops'],
            default  => null,
        };
        if ($keys === null) {
            $this->error("{$path}.type", 'Unknown kind of fill.');

            return;
        }
        $f = $this->object($value, $path, $keys);
        if ($f === null) {
            return;
        }
        if ($type === 'solid') {
            $this->color($f['color'], "{$path}.color");

            return;
        }
        if ($type === 'linear') {
            $this->number($f['angle'], "{$path}.angle", 0, 360);
        }
        foreach ($this->list($f['stops'], "{$path}.stops", 2, 6) ?? [] as $i => $stop) {
            $s = $this->object($stop, "{$path}.stops.{$i}", ['offset', 'color']);
            if ($s !== null) {
                $this->number($s['offset'], "{$path}.stops.{$i}.offset", 0, 1);
                $this->color($s['color'], "{$path}.stops.{$i}.color");
            }
        }
    }

    /**
     * @description Outline / border (shapes may have a dashed one).
     * @param mixed $value
     * @param string $path
     * @param bool $dash Whether the property `dash` belongs to it.
     * @return void
     */
    private function stroke(mixed $value, string $path, bool $dash): void
    {
        $s = $this->object($value, $path, $dash ? ['color', 'width', 'dash'] : ['color', 'width']);
        if ($s !== null) {
            $this->color($s['color'], "{$path}.color");
            $this->number($s['width'], "{$path}.width", 0, 200);
            if ($dash) {
                $this->bool($s['dash'], "{$path}.dash");
            }
        }
    }

    /**
     * @description Drop shadow.
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function shadow(mixed $value, string $path): void
    {
        $s = $this->object($value, $path, ['color', 'blur', 'x', 'y']);
        if ($s !== null) {
            $this->color($s['color'], "{$path}.color");
            $this->number($s['blur'], "{$path}.blur", 0, 200);
            $this->number($s['x'], "{$path}.x", -500, 500);
            $this->number($s['y'], "{$path}.y", -500, 500);
        }
    }

    /**
     * @description An object with exactly the given properties.
     * @param mixed $value
     * @param string $path
     * @param string[] $keys Required properties (no others allowed).
     * @return array<string, mixed>|null The object, or null after an error.
     */
    private function object(mixed $value, string $path, array $keys): ?array
    {
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            $this->error($path, 'Must be an object.');

            return null;
        }
        $unknown = array_diff(array_keys($value), $keys);
        $missing = array_diff($keys, array_keys($value));
        if ($unknown !== []) {
            $this->error($path, 'Unknown properties: ' . implode(', ', array_slice(array_map('strval', $unknown), 0, 5)) . '.');
        }
        if ($missing !== []) {
            $this->error($path, 'Missing properties: ' . implode(', ', $missing) . '.');
        }

        return $unknown === [] && $missing === [] ? $value : null;
    }

    /**
     * @description A list with a number of items in a range.
     * @param mixed $value
     * @param string $path
     * @param int $min
     * @param int $max
     * @return array<int, mixed>|null
     */
    private function list(mixed $value, string $path, int $min, int $max): ?array
    {
        if (!is_array($value) || !array_is_list($value)) {
            $this->error($path, 'Must be a list.');

            return null;
        }
        if (count($value) < $min || count($value) > $max) {
            $this->error($path, $min === $max ? "Must have {$min} items." : "Must have {$min} to {$max} items.");

            return null;
        }

        return $value;
    }

    /**
     * @description A number (integer or decimal) in a range.
     * @param mixed $value
     * @param string $path
     * @param float|int $min
     * @param float|int $max
     * @return bool Valid.
     */
    private function number(mixed $value, string $path, float|int $min, float|int $max): bool
    {
        if ((!is_int($value) && !is_float($value)) || is_nan((float) $value) || $value < $min || $value > $max) {
            $this->error($path, "Must be a number from {$min} to {$max}.");

            return false;
        }

        return true;
    }

    /**
     * @description A whole number in a range.
     * @param mixed $value
     * @param string $path
     * @param int $min
     * @param int $max
     * @return bool Valid.
     */
    private function int(mixed $value, string $path, int $min, int $max): bool
    {
        if (!is_int($value) || $value < $min || $value > $max) {
            $this->error($path, "Must be a whole number from {$min} to {$max}.");

            return false;
        }

        return true;
    }

    /**
     * @description true / false.
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function bool(mixed $value, string $path): void
    {
        if (!is_bool($value)) {
            $this->error($path, 'Must be true or false.');
        }
    }

    /**
     * @description Plain text of a length (no control characters; line breaks only when allowed).
     * @param mixed $value
     * @param string $path
     * @param int $min
     * @param int $max
     * @param bool $multiline Line breaks allowed.
     * @return void
     */
    private function string(mixed $value, string $path, int $min, int $max, bool $multiline = false): void
    {
        $control = $multiline ? '/[\x00-\x09\x0B-\x1F\x7F]/' : '/[\x00-\x1F\x7F]/';
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen($value) < $min || mb_strlen($value) > $max || preg_match($control, $value)) {
            $this->error($path, "Must be a text of {$min} to {$max} characters.");
        }
    }

    /**
     * @description One of the allowed values.
     * @param mixed $value
     * @param string $path
     * @param string[] $allowed
     * @return void
     */
    private function enum(mixed $value, string $path, array $allowed): void
    {
        if (!is_string($value) || !in_array($value, $allowed, true)) {
            $this->error($path, 'Must be one of: ' . implode(', ', $allowed) . '.');
        }
    }

    /**
     * @description Colour `#rrggbb` or `#rrggbbaa`.
     * @param mixed $value
     * @param string $path
     * @return void
     */
    private function color(mixed $value, string $path): void
    {
        if (!is_string($value) || !preg_match('/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/', $value)) {
            $this->error($path, 'Must be a colour #rrggbb or #rrggbbaa.');
        }
    }

    /**
     * @description Runs a check unless the value is null.
     * @param mixed $value
     * @param callable $check
     * @return void
     */
    private function nullable(mixed $value, callable $check): void
    {
        if ($value !== null) {
            $check($value);
        }
    }

    /**
     * @description Records an error (the first MAX_ERRORS, one per path).
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
