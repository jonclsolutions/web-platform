<?php
/**
 * @file AttachmentsTotalSize.php
 * @path app/Rules/AttachmentsTotalSize.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Validates the total size of ALL files of an attachment array at once - Laravel has
 * no built-in rule for that (`max:` on `attachments.*` checks one file). Reusable for any form
 * with multiple uploads.
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
     * @param mixed $value Array of UploadedFile instances.
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
            $fail("The total size of all attachments must not exceed {$maxMb} MB.");
        }
    }
}