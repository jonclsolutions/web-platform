<?php
/**
 * @file StoreWebSupportTicketRequest.php
 * @path app/Http/Requests/Web/WebSupportTicket/StoreWebSupportTicketRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Validation logic for creating new support tickets, including file attachment constraints.
 *
 * @refactor-note (2026-08) `$safeExtensions` drasticky zúžen. Pole je popsané jako
 * "Příloha (Screenshot / Log)" - původní seznam ale povoloval audio (mp3/wav/flac...),
 * video (mp4/mov/mkv...), CAD/design formáty (dwg/stl/psd/ai...) a širokou škálu archivů
 * (rar/7z/tar.gz), což nikdy neodpovídalo účelu pole a umožňovalo nahrát cokoliv (viz
 * incident - reálný .mp3 soubor prošel validací a přehrával se v adminu). Ponechány jen
 * typy relevantní pro screenshoty a textové/log přílohy. SVG záměrně VYLOUČENO - může
 * obsahovat vložený <script> a při přímém otevření (ne přes <img>) jde o stored XSS
 * riziko z nahraného souboru.
 */

namespace App\Http\Requests\Web\WebSupportTicket;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for new support ticket submissions from web users.
 */
class StoreWebSupportTicketRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        // Jen screenshoty a textové/log přílohy - viz @refactor-note výše.
        $safeExtensions = [
            // Screenshoty
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif',
            // Textové logy / exporty
            'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx',
            // Bundling více log souborů
            'zip',
        ];

        return [
            'user_id'          => ['nullable', 'integer', 'exists:users,id'],
            'user_name_plain'  => ['nullable', 'string', 'max:255'],
            'user_plain'       => ['nullable', 'email', 'max:255'],
            'category'         => ['required', 'string', 'max:100'],
            'subject'          => ['required', 'string', 'max:255'],
            'description'      => ['required', 'string'],
            'priority'         => ['nullable', 'string', 'max:50', 'in:low,medium,high'],
            'attachment'       => [
                'nullable',
                'file',
                'mimes:' . implode(',', $safeExtensions),
                'max:20480'
            ],
        ];
    }
}