<?php
/**
 * @file Controller.php
 * @path app/Http/Controllers/Controller.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Base class of every API controller.
 * @refactor-note (2026-10-24) Open finding #6: provides `RespondsWithData` - the one response
 *   envelope `{ data, meta? }` of the API (see the trait); controllers answer through
 *   `respond()` / `respondPaginated()` instead of building the shape themselves.
 */

namespace App\Http\Controllers;

use App\Traits\RespondsWithData;

abstract class Controller
{
    use RespondsWithData;
}
