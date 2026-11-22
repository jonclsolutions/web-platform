<?php

/**
 * @file OutputImageTest.php
 * @path api/tests/Apps/JsCreator/Unit/OutputImageTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the conversion of a generated output (OutputImage) and of the file
 *   names of outputs (FileController::fileName()).
 * @dependencies OutputImage, FileController, GD.
 */

namespace Tests\Apps\JsCreator\Unit;

use App\Apps\JsCreator\Http\Controllers\FileController;
use App\Apps\JsCreator\Support\OutputImage;
use RuntimeException;
use Tests\TestCase;

/**
 * @description OutputImage::convert(), FileController::fileName().
 */
class OutputImageTest extends TestCase
{
    /**
     * @description A PNG of the right size is kept as a PNG with its transparency, or becomes a
     *   JPEG over white; both get a WebP thumbnail.
     * @input semi-transparent PNG 300×150 → png; → jpg 70.
     * @output PNG 300×150 with alpha at a pixel; JPEG 300×150; thumbnails WebP 300×150 (smaller
     *   than 480 px, never enlarged).
     */
    public function test_converts_to_png_and_jpg(): void
    {
        $png = $this->png(300, 150, 64);

        $kept = OutputImage::convert($png, 300, 150, 'png', 90);
        $this->assertSame(['image/png', 'png'], [$kept['mime'], $kept['extension']]);
        $image = imagecreatefromstring($kept['file']);
        $this->assertSame(64, imagecolorsforindex($image, imagecolorat($image, 10, 10))['alpha']);
        $thumb = getimagesizefromstring($kept['thumb']);
        $this->assertSame(['image/webp', 300, 150], [$thumb['mime'], $thumb[0], $thumb[1]]);

        $jpeg = OutputImage::convert($png, 300, 150, 'jpg', 70);
        $info = getimagesizefromstring($jpeg['file']);
        $this->assertSame(['image/jpeg', 'jpg', 'image/jpeg', 300, 150], [$jpeg['mime'], $jpeg['extension'], $info['mime'], $info[0], $info[1]]);
    }

    /**
     * @description Another size than the template and files that are not PNG are refused.
     * @input PNG 300×150 for a template 300×151; JPEG; text.
     * @output RuntimeException wrong_size / not_png / not_png.
     */
    public function test_refuses_other_sizes_and_types(): void
    {
        $cases = [
            'wrong_size' => [$this->png(300, 150), 151],
            'not_png'    => [$this->jpeg(300, 150), 150],
        ];
        foreach ($cases as $expected => [$binary, $height]) {
            try {
                OutputImage::convert($binary, 300, $height, 'png', 90);
                $this->fail("Expected {$expected}");
            } catch (RuntimeException $e) {
                $this->assertSame($expected, $e->getMessage());
            }
        }
        $this->expectExceptionMessage('not_png');
        OutputImage::convert('plain text', 300, 150, 'png', 90);
    }

    /**
     * @description File names keep the name (also Czech letters) without characters that are not
     *   allowed in file names, with the extension of the format.
     * @input "Léto: 50 % / sleva?", "...", "a\tb", 200 characters.
     * @output "Léto- 50 % - sleva.png", "output.jpg", "a-b.png", 120 characters + ".png".
     */
    public function test_file_names(): void
    {
        $this->assertSame('Léto- 50 % - sleva.png', FileController::fileName('Léto: 50 % / sleva?', 'png'));
        $this->assertSame('output.jpg', FileController::fileName('...', 'jpg'));
        $this->assertSame('a-b.png', FileController::fileName("a\tb", 'png'));
        $this->assertSame(124, mb_strlen(FileController::fileName(str_repeat('ř', 200), 'png')));
    }

    /**
     * @description PNG of one colour.
     * @param int $width
     * @param int $height
     * @param int $alpha 0 (opaque) … 127 (transparent).
     * @return string
     */
    private function png(int $width, int $height, int $alpha = 0): string
    {
        $image = imagecreatetruecolor($width, $height);
        imagesavealpha($image, true);
        imagealphablending($image, false);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 200, 20, 20, $alpha));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    /**
     * @description JPEG of one colour.
     * @param int $width
     * @param int $height
     * @return string
     */
    private function jpeg(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagejpeg($image);

        return (string) ob_get_clean();
    }
}
