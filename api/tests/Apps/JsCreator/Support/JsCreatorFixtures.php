<?php

/**
 * @file JsCreatorFixtures.php
 * @path api/tests/Apps/JsCreator/Support/JsCreatorFixtures.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test helpers of JS Creator: accounts with the permissions of the section Images,
 *   generated uploads (PNG, JPEG with an EXIF orientation, fonts by their signature) and a fake
 *   private disk.
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
}
