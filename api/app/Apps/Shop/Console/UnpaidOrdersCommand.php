<?php

/**
 * @file UnpaidOrdersCommand.php
 * @path app/Apps/Shop/Console/UnpaidOrdersCommand.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description `php artisan shop:unpaid-orders [--dry-run]` - payment reminders and automatic
 * cancellation of unpaid bank-transfer orders (UnpaidOrders, audit B-04). Scheduled every hour
 * (ShopApp::schedule()); safe to run by hand any time.
 * @dependencies UnpaidOrders.
 */

namespace App\Apps\Shop\Console;

use App\Apps\Shop\Services\UnpaidOrders;
use Illuminate\Console\Command;

class UnpaidOrdersCommand extends Command
{
    /** @var string Signature of the command. */
    protected $signature = 'shop:unpaid-orders {--dry-run : Only count the orders, change and send nothing}';

    /** @var string Description of the command. */
    protected $description = 'Payment reminders and automatic cancellation of unpaid bank-transfer orders of the e-shop.';

    /**
     * @description Runs the reminders and cancellations and prints how many there were.
     * @param UnpaidOrders $unpaid The service.
     * @return int Exit code.
     */
    public function handle(UnpaidOrders $unpaid): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $result = $unpaid->run($dryRun);
        $this->info(sprintf('%sReminded: %d, canceled: %d.', $dryRun ? '[dry run] ' : '', $result['reminded'], $result['canceled']));

        return self::SUCCESS;
    }
}
