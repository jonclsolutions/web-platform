<?php
/**
 * @file shop_payment_methods.php
 * @path api/app/Apps/Shop/Database/Seeders/data/shop_payment_methods.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Default payment methods of the e-shop (ShopBaseDataSeeder). The admin cannot create or
 *   delete payment methods (only edit them: name, description, fee, bank details, gateway keys,
 *   active, order), so every installation gets this fixed set - the eight methods of the former
 *   database dump, identified by `code`.
 * @note Only "Cash on store pickup" is active from the start: it needs no setup and goes with the
 *   default shipping method (store pickup). Bank transfers need the bank details, the gateways
 *   (Stripe, Apple Pay, Google Pay, PayPal) their keys - the admin fills them in and switches the
 *   method on. No bank details or keys are stored here (they belong to the operator, not to git).
 * @note Fees are 0 - the e-shop prices in EUR (the former dump had CZK amounts).
 * @note `image` = the former logo on the public disk (used when the file exists there - a server
 *   installed from the dump keeps its logos), `default_image` = a neutral icon of
 *   app/Apps/Shop/Database/Seeders/assets/payment-methods (copied to the public disk otherwise).
 */

return [
    [
        'code' => 'bank_transfer_cz', 'name' => 'Bankovní převod (CZ)',
        'description' => 'Platba převodem na náš bankovní účet v rámci ČR.',
        'provider' => 'manual', 'is_external' => false, 'variable_symbol_type' => 'order_number', 'config' => [],
        'is_active' => false, 'sort_order' => 1,
        'image' => 'payment-methods-images/bank-transfer-cz.png', 'default_image' => 'bank.svg',
    ],
    [
        'code' => 'bank_transfer_sepa', 'name' => 'Bankovní převod (EUR / SEPA)',
        'description' => 'Platba v EUR prostřednictvím SEPA převodu. Vhodné pro zákazníky ze Slovenska a EU.',
        'provider' => 'manual', 'is_external' => false, 'variable_symbol_type' => 'order_number', 'config' => [],
        'is_active' => false, 'sort_order' => 2,
        'image' => 'payment-methods-images/bank_transfer_eu.svg', 'default_image' => 'bank.svg',
    ],
    [
        'code' => 'stripe_card', 'name' => 'Platba kartou online',
        'description' => 'Rychlá a bezpečná platba kartou Visa, MasterCard nebo Maestro přes platební bránu Stripe.',
        'provider' => 'stripe', 'is_external' => true, 'variable_symbol_type' => 'none',
        'config' => ['public_key' => null, 'secret_key' => null, 'webhook_secret' => null],
        'is_active' => false, 'sort_order' => 3,
        'image' => 'payment-methods-images/stripe-card.png', 'default_image' => 'card.svg',
    ],
    [
        'code' => 'apple_pay', 'name' => 'Apple Pay',
        'description' => 'Rychlá platba pomocí Apple Wallet pro zařízení Apple (iPhone, iPad, Mac).',
        'provider' => 'stripe', 'is_external' => true, 'variable_symbol_type' => 'none',
        'config' => ['public_key' => null, 'secret_key' => null, 'webhook_secret' => null],
        'is_active' => false, 'sort_order' => 4,
        'image' => 'payment-methods-images/apple-pay.png', 'default_image' => 'wallet.svg',
    ],
    [
        'code' => 'google_pay', 'name' => 'Google Pay',
        'description' => 'Okamžitá platba pomocí Google peněženky pro zařízení Android a prohlížeč Chrome.',
        'provider' => 'stripe', 'is_external' => true, 'variable_symbol_type' => 'none',
        'config' => ['public_key' => null, 'secret_key' => null, 'webhook_secret' => null],
        'is_active' => false, 'sort_order' => 5,
        'image' => 'payment-methods-images/google-pay.png', 'default_image' => 'wallet.svg',
    ],
    [
        'code' => 'paypal', 'name' => 'PayPal',
        'description' => 'Platba přes celosvětový platební systém PayPal (účet nebo rychlá platba kartou).',
        'provider' => 'paypal', 'is_external' => true, 'variable_symbol_type' => 'none',
        'config' => ['client_id' => null, 'secret_key' => null, 'mode' => 'sandbox'],
        'is_active' => false, 'sort_order' => 6,
        'image' => 'payment-methods-images/paypal.png', 'default_image' => 'wallet.svg',
    ],
    [
        'code' => 'cash_on_delivery', 'name' => 'Platba při převzetí (dobírka)',
        'description' => 'Zaplatíte hotově nebo kartou kurýrovi při převzetí zásilky na Vaší adrese.',
        'provider' => 'manual', 'is_external' => false, 'variable_symbol_type' => 'none', 'config' => [],
        'is_active' => false, 'sort_order' => 7,
        'image' => 'payment-methods-images/cash-on-delivery.png', 'default_image' => 'delivery.svg',
    ],
    [
        'code' => 'cash', 'name' => 'Hotovost při osobním odběru',
        'description' => 'Platba v hotovosti na naší prodejně při vyzvednutí zboží.',
        'provider' => 'manual', 'is_external' => false, 'variable_symbol_type' => 'none', 'config' => [],
        'is_active' => true, 'sort_order' => 8,
        'image' => 'payment-methods-images/cash.png', 'default_image' => 'cash.svg',
    ],
];
