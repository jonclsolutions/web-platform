<?php

/**
 * @file TemplateDocumentTest.php
 * @path api/tests/Apps/JsCreator/Unit/TemplateDocumentTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the strict validation of a template document (TemplateDocument):
 *   a complete document of every kind of layer passes; unknown / missing properties, wrong
 *   kinds, ranges, colours, field references, grid cells, ids, limits and texts are refused;
 *   library images, own fonts and blocks are collected; a block cannot contain a block.
 * @dependencies TemplateDocument, JsCreatorFixtures (documents).
 */

namespace Tests\Apps\JsCreator\Unit;

use App\Apps\JsCreator\Support\TemplateDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description TemplateDocument::check().
 */
class TemplateDocumentTest extends TestCase
{
    use JsCreatorFixtures;

    /**
     * @description A document with every kind of layer, fields, gradients, shadows and a
     *   background image passes and its files are collected.
     * @input text field + image field; text (field, own font, box, stroke, shadow), image (asset),
     *   grid (field + asset cells), shape (gradient, dashed stroke), icon; background image of a
     *   field with a radial overlay.
     * @output no errors; assets [7, 8]; fonts [3].
     */
    public function test_complete_document_passes(): void
    {
        $document = $this->document([
            $this->layer('text', [
                'field' => 'title', 'font' => ['family' => 'user:3', 'weight' => 400, 'style' => 'italic'],
                'stroke' => ['color' => '#000000', 'width' => 2], 'shadow' => ['color' => '#00000080', 'blur' => 8, 'x' => 0, 'y' => 4],
                'box' => ['fill' => ['type' => 'solid', 'color' => '#ffffffcc'], 'padding' => 16, 'radius' => 8, 'fit' => 'text'],
                'text' => "Line one\nLine **two**",
            ]),
            $this->layer('image', ['source' => ['kind' => 'asset', 'assetId' => 7], 'mask' => 'circle', 'anchor' => 'tr', 'x' => -40]),
            $this->layer('grid', ['layout' => '1+2', 'cells' => [
                ['source' => ['kind' => 'field', 'field' => 'photo'], 'focusX' => 0.2, 'focusY' => 0.8],
                ['source' => ['kind' => 'asset', 'assetId' => 8], 'focusX' => 0.5, 'focusY' => 0.5],
                ['source' => ['kind' => 'none'], 'focusX' => 0.5, 'focusY' => 0.5],
            ]]),
            $this->layer('shape', [
                'fill' => ['type' => 'linear', 'angle' => 45, 'stops' => [['offset' => 0, 'color' => '#ff0000'], ['offset' => 1, 'color' => '#0000ff']]],
                'stroke' => ['color' => '#111111', 'width' => 3, 'dash' => true],
            ]),
            $this->layer('icon', ['icon' => 'map-pin', 'strokeWidth' => 1.5]),
        ], [$this->textField('title'), $this->imageField('photo')]);
        $document['pages'][0]['background']['image'] = [
            'source' => ['kind' => 'field', 'field' => 'photo'], 'fit' => 'cover', 'focusX' => 0.5, 'focusY' => 0.5,
            'overlay' => ['type' => 'radial', 'stops' => [['offset' => 0, 'color' => '#00000000'], ['offset' => 1, 'color' => '#000000aa']]],
        ];

        $result = TemplateDocument::check($document);

        $this->assertSame([], $result->errors());
        $this->assertEqualsCanonicalizing([7, 8], $result->assetIds());
        $this->assertSame([3], $result->fontIds());
        $this->assertSame([], TemplateDocument::check(TemplateDocument::empty())->errors());
    }

    /**
     * @description Invalid documents are refused with the path of the error.
     * @input One broken property each (see the data provider).
     * @output The expected path among the errors.
     */
    #[DataProvider('brokenDocuments')]
    public function test_invalid_documents_are_refused(callable $break, string $path): void
    {
        $document = $this->document([$this->layer('text'), $this->layer('image'), $this->layer('grid')], [$this->textField(), $this->imageField()]);
        $break($document);

        $this->assertArrayHasKey($path, TemplateDocument::check($document)->errors());
    }

    /**
     * @description Broken documents with the path of their error.
     * @return array<string, array{0: callable, 1: string}>
     */
    public static function brokenDocuments(): array
    {
        return [
            'unknown property'       => [function (&$d) { $d['pages'][0]['layers'][0]['onclick'] = 'x'; }, 'document.pages.0.layers.0'],
            'missing property'       => [function (&$d) { unset($d['pages'][0]['layers'][0]['size']); }, 'document.pages.0.layers.0'],
            'unknown layer'          => [function (&$d) { $d['pages'][0]['layers'][0]['type'] = 'html'; }, 'document.pages.0.layers.0.type'],
            'size out of range'      => [function (&$d) { $d['pages'][0]['layers'][0]['size'] = 5000; }, 'document.pages.0.layers.0.size'],
            'number as text'         => [function (&$d) { $d['pages'][0]['layers'][0]['x'] = '10'; }, 'document.pages.0.layers.0.x'],
            'bad colour'             => [function (&$d) { $d['pages'][0]['layers'][0]['fill']['color'] = 'red'; }, 'document.pages.0.layers.0.fill.color'],
            'one gradient stop'      => [function (&$d) { $d['pages'][0]['layers'][0]['fill'] = ['type' => 'radial', 'stops' => [['offset' => 0, 'color' => '#000000']]]; }, 'document.pages.0.layers.0.fill.stops'],
            'control character'      => [function (&$d) { $d['pages'][0]['layers'][0]['name'] = "a\x07b"; }, 'document.pages.0.layers.0.name'],
            'line break in a name'   => [function (&$d) { $d['pages'][0]['layers'][0]['name'] = "a\nb"; }, 'document.pages.0.layers.0.name'],
            'text too long'          => [function (&$d) { $d['pages'][0]['layers'][0]['text'] = str_repeat('a', 2001); }, 'document.pages.0.layers.0.text'],
            'unknown font'           => [function (&$d) { $d['pages'][0]['layers'][0]['font']['family'] = 'Arial'; }, 'document.pages.0.layers.0.font.family'],
            'unknown text field'     => [function (&$d) { $d['pages'][0]['layers'][0]['field'] = 'nope'; }, 'document.pages.0.layers.0.field'],
            'image field as text'    => [function (&$d) { $d['pages'][0]['layers'][0]['field'] = 'photo'; }, 'document.pages.0.layers.0.field'],
            'text field as image'    => [function (&$d) { $d['pages'][0]['layers'][1]['source'] = ['kind' => 'field', 'field' => 'title']; }, 'document.pages.0.layers.1.source.field'],
            'asset id zero'          => [function (&$d) { $d['pages'][0]['layers'][1]['source'] = ['kind' => 'asset', 'assetId' => 0]; }, 'document.pages.0.layers.1.source.assetId'],
            'url as source'          => [function (&$d) { $d['pages'][0]['layers'][1]['source'] = ['kind' => 'url', 'url' => 'https://x.test/a.png']; }, 'document.pages.0.layers.1.source.kind'],
            'grid cells mismatch'    => [function (&$d) { array_pop($d['pages'][0]['layers'][2]['cells']); }, 'document.pages.0.layers.2.cells'],
            'duplicate layer id'     => [function (&$d) { $d['pages'][0]['layers'][1]['id'] = $d['pages'][0]['layers'][0]['id']; }, 'document.pages.0.layers.1.id'],
            'duplicate field key'    => [function (&$d) { $d['fields'][1]['key'] = 'title'; }, 'document.fields.1.key'],
            'bad field key'          => [function (&$d) { $d['fields'][0]['key'] = 'Title!'; }, 'document.fields.0.key'],
            'two pages'              => [function (&$d) { $d['pages'][] = $d['pages'][0]; }, 'document.pages'],
            'other schema'           => [function (&$d) { $d['schema'] = 2; }, 'document.schema'],
            'layers as object'       => [function (&$d) { $d['pages'][0]['layers'] = ['a' => 1]; }, 'document.pages.0.layers'],
            'too many layers'        => [function (&$d) {
                $d['pages'][0]['layers'] = array_map(fn ($i) => ['id' => "x{$i}"] + $d['pages'][0]['layers'][0], range(1, 201));
            }, 'document.pages.0.layers'],
        ];
    }

    /**
     * @description A document over 1 MB is refused before anything else is checked.
     * @input 300 text layers with 2000 two-byte characters each (≈ 1.2 MB).
     * @output Error at `document` (too large).
     */
    public function test_document_over_one_megabyte_is_refused(): void
    {
        $layers = array_map(fn ($i) => $this->layer('text', ['id' => "big{$i}", 'text' => str_repeat('ž', 2000)]), range(1, 300));

        $this->assertArrayHasKey('document', TemplateDocument::check($this->document($layers))->errors());
    }

    /**
     * @description Block instances: allowed in a template (blocks collected), refused inside a
     *   block (blocks do not nest), the scale and the block id are checked.
     * @input template with two instances of block 5 and one of block 9; the same document as a
     *   block; scale 0 and 25; block id "5" (a string).
     * @output no errors and blocks [5, 9] with the path of the first use; error at `.type` for a
     *   block; errors at `.scale` and `.blockId`.
     */
    public function test_block_instances(): void
    {
        $document = $this->document([
            $this->layer('block', ['blockId' => 5, 'scale' => 0.5]),
            $this->layer('block', ['blockId' => 9, 'scale' => 2.25, 'anchor' => 'tr']),
            $this->layer('block', ['blockId' => 5, 'scale' => 1]),
        ]);

        $template = TemplateDocument::check($document);
        $this->assertSame([], $template->errors());
        $this->assertSame([5, 9], $template->blockIds());
        $this->assertSame('document.pages.0.layers.0.blockId', $template->pathOf('block', 5));

        $block = TemplateDocument::check($document, false);
        $this->assertArrayHasKey('document.pages.0.layers.0.type', $block->errors());
        $this->assertSame([], $block->blockIds());

        $bad = TemplateDocument::check($this->document([
            $this->layer('block', ['scale' => 0]),
            $this->layer('block', ['scale' => 25]),
            $this->layer('block', ['blockId' => '5']),
        ]))->errors();
        $this->assertArrayHasKey('document.pages.0.layers.0.scale', $bad);
        $this->assertArrayHasKey('document.pages.0.layers.1.scale', $bad);
        $this->assertArrayHasKey('document.pages.0.layers.2.blockId', $bad);
        $this->assertSame('#ffffff00', TemplateDocument::empty(true)['pages'][0]['background']['fill']['color']);
        $this->assertSame([], TemplateDocument::check(TemplateDocument::empty(true), false)->errors());
    }
}
