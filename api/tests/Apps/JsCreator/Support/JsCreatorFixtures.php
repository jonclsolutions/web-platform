<?php

/**
 * @file JsCreatorFixtures.php
 * @path api/tests/Apps/JsCreator/Support/JsCreatorFixtures.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test helpers of JS Creator: accounts with the permissions of the section Images,
 *   generated uploads (PNG, JPEG with an EXIF orientation, fonts by their signature), a fake
 *   private disk and complete template documents (every kind of layer, fields, fills).
 * @dependencies Tests\Support\InteractsWithAccounts (userWith), GD.
 */

namespace Tests\Apps\JsCreator\Support;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * @description Mixed into the feature tests of the application.
 */
trait JsCreatorFixtures
{
    /** @var string JPEG 40×20 (left half red, right half blue) with EXIF orientation 6 and a camera name. */
    protected string $orientedJpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/4QA2RXhpZgAATU0AKgAAAAgAAgEPAAIAAAAIAAAAJgESAAMAAAABAAYAAAAAAABUZXN0Q2FtAP/bAEMAAwICAwICAwMDAwQDAwQFCAUFBAQFCgcHBggMCgwMCwoLCw0OEhANDhEOCwsQFhARExQVFRUMDxcYFhQYEhQVFP/bAEMBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIABQAKAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APnSiiivww/1TOB+Kv8AzC/+2v8A7JXAV3/xV/5hf/bX/wBkrgK/1U8Ev+SAy7/uL/6fqH+a/i//AMlvj/8AuH/6ZphRRRX7kfjh77RRRX+HJ/sWcD8Vf+YX/wBtf/ZK4Ciiv9VPBL/kgMu/7i/+n6h/mv4v/wDJb4//ALh/+maYUUUV+5H44f/Z';

    /**
     * @description Account with the tab permission and the given actions of the section Images.
     * @param string[] $actions Actions (view, create, update, delete).
     * @param string[] $extra Further permission keys.
     * @return User
     */
    protected function creator(array $actions = ['view', 'create', 'update', 'delete'], array $extra = []): User
    {
        return $this->userWith(['view-js-creator', ...array_map(fn (string $a) => "js-creator-images-{$a}", $actions), ...$extra]);
    }

    /**
     * @description Fake private disk of the workspace files.
     * @return void
     */
    protected function fakeDisk(): void
    {
        Storage::fake('private');
    }

    /**
     * @description PNG upload of one colour (optionally semi-transparent).
     * @param int $width
     * @param int $height
     * @param string $name File name.
     * @param int $alpha 0 (opaque) … 127 (transparent).
     * @return UploadedFile
     */
    protected function png(int $width = 30, int $height = 20, string $name = 'logo.png', int $alpha = 0): UploadedFile
    {
        $image = imagecreatetruecolor($width, $height);
        imagesavealpha($image, true);
        imagealphablending($image, false);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 10, 200, 30, $alpha));
        ob_start();
        imagepng($image);

        return UploadedFile::fake()->createWithContent($name, (string) ob_get_clean());
    }

    /**
     * @description The JPEG with EXIF orientation 6 as an upload.
     * @return UploadedFile
     */
    protected function orientedJpeg(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('photo.jpg', base64_decode($this->orientedJpeg));
    }

    /**
     * @description Font upload: the signature of the format followed by filler bytes.
     * @param string $signature First 4 bytes ("wOF2", "OTTO", "\x00\x01\x00\x00", …).
     * @param string $name File name (its extension is checked against the signature).
     * @param int $size Size in bytes.
     * @return UploadedFile
     */
    protected function font(string $signature = 'wOF2', string $name = 'brand.woff2', int $size = 2048): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $signature . str_repeat("\x00", max(0, $size - 4)));
    }

    /**
     * @description Complete document of schema 1 with one page.
     * @param array<int, array<string, mixed>> $layers Layers of the page.
     * @param array<int, array<string, mixed>> $fields Fields.
     * @return array<string, mixed>
     */
    protected function document(array $layers = [], array $fields = []): array
    {
        return [
            'schema' => 1,
            'fields' => $fields,
            'pages'  => [['background' => ['fill' => ['type' => 'solid', 'color' => '#ffffff'], 'image' => null], 'layers' => $layers]],
        ];
    }

    /**
     * @description Complete layer of a kind with its default properties.
     * @param string $type text | image | grid | shape | icon | block.
     * @param array<string, mixed> $overrides Properties to change.
     * @return array<string, mixed>
     */
    protected function layer(string $type, array $overrides = []): array
    {
        static $counter = 0;
        $counter++;
        $common = [
            'id' => "l{$counter}", 'type' => $type, 'name' => '', 'anchor' => 'tl', 'x' => 40, 'y' => 40, 'w' => 300, 'h' => 200,
            'rotation' => 0, 'opacity' => 1, 'hidden' => false, 'locked' => false,
        ];
        $specific = match ($type) {
            'text' => [
                'field' => null, 'text' => 'Hello', 'font' => ['family' => 'set:inter', 'weight' => 700, 'style' => 'normal'], 'size' => 64,
                'fill' => ['type' => 'solid', 'color' => '#111111'], 'lineHeight' => 1.2, 'letterSpacing' => 0, 'align' => 'left', 'valign' => 'top',
                'uppercase' => false, 'maxLines' => 0, 'autoShrink' => true, 'minSize' => 24, 'overflow' => 'ellipsis', 'stroke' => null,
                'shadow' => null, 'box' => null, 'highlight' => ['color' => '#e11d48', 'bold' => true, 'background' => null],
            ],
            'image' => [
                'source' => ['kind' => 'none'], 'fit' => 'cover', 'focusX' => 0.5, 'focusY' => 0.5, 'radius' => 0, 'mask' => 'none',
                'border' => null, 'shadow' => null, 'overlay' => null, 'flipX' => false,
            ],
            'grid' => [
                'layout' => '2x2', 'gap' => 8, 'radius' => 0, 'fit' => 'cover', 'border' => null, 'overlay' => null,
                'cells' => array_fill(0, 4, ['source' => ['kind' => 'none'], 'focusX' => 0.5, 'focusY' => 0.5]),
            ],
            'shape' => ['shape' => 'rect', 'fill' => ['type' => 'solid', 'color' => '#f59e0b'], 'radius' => 12, 'stroke' => null, 'shadow' => null],
            'icon'  => ['icon' => 'star', 'color' => '#111111', 'strokeWidth' => 2, 'shadow' => null],
            'block' => ['blockId' => 1, 'scale' => 1],
        };

        return array_replace($common, $specific, $overrides);
    }

    /**
     * @description Text field of a template.
     * @param string $key Key.
     * @return array<string, mixed>
     */
    protected function textField(string $key = 'title'): array
    {
        return ['key' => $key, 'type' => 'text', 'label' => 'Title', 'help' => '', 'required' => true, 'sample' => 'Sample', 'maxLength' => 120, 'multiline' => false];
    }

    /**
     * @description Image field of a template.
     * @param string $key Key.
     * @return array<string, mixed>
     */
    protected function imageField(string $key = 'photo'): array
    {
        return ['key' => $key, 'type' => 'image', 'label' => 'Photo', 'help' => '', 'required' => true, 'minWidth' => 0, 'minHeight' => 0];
    }
}
