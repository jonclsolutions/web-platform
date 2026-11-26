<?php

/**
 * @file PlainTextTest.php
 * @path api/tests/Unit/Core/PlainTextTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PlainText (texts of the website are plain text): `<br>` → new line,
 *   paragraphs → empty line between them, every other tag (also a script) removed, "<" that is
 *   no tag kept; a translation tree keeps its keys and non-text values.
 * @dependencies Tests\TestCase
 */

namespace Tests\Unit\Core;

use App\Support\I18n\PlainText;
use Tests\TestCase;

class PlainTextTest extends TestCase
{
    /**
     * @description Older HTML of the texts becomes plain text; plain texts stay the same.
     * @input '<br>', '<BR />', '<p>A</p><p>B</p>', '<p class="x">A</p>\n<p>B</p>', a script, an
     *   image with onerror, a link, 'a < b', '<3', plain text.
     * @output new lines / empty lines; tags removed (their text kept); the rest unchanged.
     */
    public function test_html_becomes_plain_text(): void
    {
        $this->assertSame("Jsme IT,\nkterá staví", PlainText::fromHtml('Jsme IT,<br>která staví'));
        $this->assertSame("A\nB", PlainText::fromHtml('A<BR />B'));
        $this->assertSame("A\n\nB", PlainText::fromHtml('<p>A</p><p>B</p>'));
        $this->assertSame("A\n\nB", PlainText::fromHtml("<p class=\"x\">A</p>\n<p>B</p>"));
        $this->assertSame('alert(1)Text', PlainText::fromHtml('<script>alert(1)</script>Text'));
        $this->assertSame('Obrázek', PlainText::fromHtml('<img src=x onerror="alert(1)">Obrázek'));
        $this->assertSame('odkaz', PlainText::fromHtml('<a href="javascript:alert(1)">odkaz</a>'));
        foreach (['a < b', 'Mám tě <3', 'Obyčejný text', ''] as $plain) {
            $this->assertSame($plain, PlainText::fromHtml($plain));
        }
    }

    /**
     * @description A translation tree: every text plain, keys, lists, numbers and booleans kept.
     * @input {hero: {heading: 'A<br>B'}, list: ['<b>x</b>', 'y'], count: 3, on: true, none: null}
     * @output {hero: {heading: "A\nB"}, list: ['x', 'y'], count: 3, on: true, none: null}
     */
    public function test_translation_tree(): void
    {
        $this->assertSame(
            ['hero' => ['heading' => "A\nB"], 'list' => ['x', 'y'], 'count' => 3, 'on' => true, 'none' => null],
            PlainText::tree(['hero' => ['heading' => 'A<br>B'], 'list' => ['<b>x</b>', 'y'], 'count' => 3, 'on' => true, 'none' => null])
        );
    }
}
