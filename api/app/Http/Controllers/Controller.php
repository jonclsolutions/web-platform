<?php
/**
 * @file Controller.php
 * @path app/Http/Controllers/Controller.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Base class of every API controller.
 */

namespace App\Http\Controllers;

use App\Traits\RespondsWithData;

abstract class Controller
{
    use RespondsWithData;
}
