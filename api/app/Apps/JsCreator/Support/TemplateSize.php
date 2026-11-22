<?php
/**
 * @file TemplateSize.php
 * @path app/Apps/JsCreator/Support/TemplateSize.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Limits of the size of a template (px per side). The presets of the social
 *   networks are only in the editor; a template stores its width and height.
 * @note The same limits are in the frontend (render/document.ts).
 */

namespace App\Apps\JsCreator\Support;

final class TemplateSize
{
    /** @description Smallest side (px). */
    public const MIN = 100;

    /** @description Largest side (px). */
    public const MAX = 3000;
}
