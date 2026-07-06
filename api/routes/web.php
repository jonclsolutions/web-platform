<?php
/**
 * @file routes/web.php
 * @path routes/web.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Defines the web-facing routes for the application.
 */

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group.
|
*/

/**
 * Handle unauthenticated access attempts.
 * The 'login' route name is required by Laravel's authentication middleware
 * to properly handle redirects for unauthorized requests.
 */
Route::get('/login', function () {
    return response('Unauthorized.', 401);
})->name('login');

/**
 * Public landing page route.
 */
Route::get('/', function () {
    return view('welcome');
});