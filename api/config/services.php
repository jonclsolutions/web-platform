<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'turnstile' => [
        'secret_key' => env('TURNSTILE_SECRET_KEY'),
        'verify_url' => 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    ],

    /*
    | @bugfix-note (2026-10-23) The public `POST shop/checkout/simulate-payment` endpoint
    | marked ANY order as paid + confirmed for anyone who knew (or guessed) its id. It
    | exists only as a stand-in for a real payment gateway, so it is now switched off in
    | production by default; set SHOP_PAYMENT_SIMULATION=true only on dev / test systems.
    */
    'shop' => [
        'payment_simulation' => (bool) env('SHOP_PAYMENT_SIMULATION', env('APP_ENV', 'production') !== 'production'),
    ],

];
