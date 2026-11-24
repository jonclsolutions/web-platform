<?php

/**
 * @file seo.php
 * @path routes/seo.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Routes for search engines and the bare domain, outside `/api` and without any
 *   middleware group (no session, no cookie): `/` (language of the visitor), `/robots.txt`,
 *   `/sitemap.xml`. Loaded by bootstrap/app.php (withRouting `then`); the proxy
 *   (deploy/docker/Caddyfile) forwards exactly these three paths to PHP.
 * @dependencies PublicSeoController
 */

use App\Http\Controllers\Api\PublicSeoController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PublicSeoController::class, 'root']);
Route::get('/robots.txt', [PublicSeoController::class, 'robots']);
Route::get('/sitemap.xml', [PublicSeoController::class, 'sitemap']);
