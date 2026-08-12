<?php
/**
 * @file AttachmentsTotalSize.php
 * @path app/Rules/AttachmentsTotalSize.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validuje souhrnnou velikost VŠECH souborů v poli příloh najednou - Laravel
 * nemá vestavěné pravidlo pro součet velikostí napříč polem souborů (`max:` na
 * `attachments.*` hlídá jen jednotlivý soubor). Znovupoužitelné pro libovolný formulář
 * s vícenásobným uploadem (raw_request_commissions, sales_orders, budoucí admin formuláře).
 */

namespace App\Rules;

use Illuminate\Contracts\Validation\ValidationRule;
use Closure;

class AttachmentsTotalSize implements ValidationRule
{
    public function __construct(private int $maxTotalBytes)
    {
    }

    /**
     * @param string $attribute
     * @param mixed $value Pole UploadedFile instancí.
     * @param Closure $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_array($value)) {
            return;
        }

        $total = array_sum(array_map(
            fn($file) => $file instanceof \Illuminate\Http\UploadedFile ? $file->getSize() : 0,
            $value
        ));

        if ($total > $this->maxTotalBytes) {
            $maxMb = round($this->maxTotalBytes / 1024 / 1024);
            $fail("Celková velikost všech příloh nesmí přesáhnout {$maxMb} MB.");
        }
    }
}