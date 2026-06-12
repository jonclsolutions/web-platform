<?php

namespace App\Http\Requests\Web\WebSalesLead;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWebSalesLeadRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'subject_name'       => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
            'user_id'            => ['nullable', 'integer', 'exists:users,id'],
            'first_contact_date' => ['nullable', 'date'], 
            'source_channel'     => ['sometimes', 'required', 'string', 'max:255', 'in:' . implode(',', [
                'LinkedIn - Direct Message', 'LinkedIn - Komentář/Post', 'Facebook - Skupina',
                'Facebook - Direct Message', 'Instagram - DM', 'X (Twitter)', 'WhatsApp',
                'Telegram', 'Webový formulář', 'Email - Studený (Cold Email)', 'Email - Newsletter',
                'Telefon - Studený (Cold Call)', 'Telefon - Příchozí poptávka', 'Osobní setkání',
                'Networking / Akce / Konference', 'Doporučení (Referral)', 'Bývalý klient',
                'Poptávkový portál', 'Google Moje Firma', 'Inzerát / Placená reklama (PPC)',
                'Partner / Affiliate', 'Jiný online kanál', 'Jiný offline kanál'
            ])],
            'salesman_name'      => ['nullable', 'string', 'max:255'],
            'contact_person'     => ['nullable', 'string', 'max:255'],
            'contact_email'      => ['nullable', 'email', 'max:255'],
            'contact_phone'      => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'contact_other'      => ['nullable', 'string', 'max:255'],
            'location'           => ['nullable', 'string', 'max:100'],
            'source_url'         => ['nullable', 'url', 'max:500'],
            'description'        => ['nullable', 'string'],
            'priority'           => ['sometimes', 'required', 'string', 'max:255', 'in:Nízká,Podprůměrná,Neutrální,Vysoká,Kritická'],
            'status'             => ['sometimes', 'required', 'string', 'max:255', 'in:' . implode(',', [
                'Nové', 'Probíhá komunikace', 'Příprava nabídky', 'Nabídka odeslána', 
                'Poptávkový formulář odeslán', 'Vyjednávání', 'Pozastaveno', 'Přebírá si dev team',
                'Uzavřeno - Získáno', 'Čeká se na fakturaci', 'Čeká se na zaplacení',
                'Uhrazeno - Projekt spuštěn', 'Uzavřeno - Ztraceno', 'Jiné'
            ])],
            'last_contact_date'  => ['nullable', 'date'], 
            'next_step'          => ['nullable', 'string', 'max:255'],
            'rejection_reason'   => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'subject_name.required'     => 'Název subjektu nebo firmy je povinný.',
            'subject_name.min'          => 'Název subjektu musí mít alespoň 2 znaky.',
            'source_channel.required'   => 'Vyberte zdroj oslovení.',
            'source_channel.in'         => 'Vybraný zdroj oslovení je neplatný.',
            'contact_email.email'       => 'Zadejte platnou e-mailovou adresu.',
            'contact_phone.regex'       => 'Zadejte platné telefonní číslo.',
            'source_url.url'            => 'Zadejte platnou URL adresu.',
            'priority.required'         => 'Vyberte prioritu leadu.',
            'priority.in'               => 'Vybraná priorita je neplatná.',
            'status.required'           => 'Vyberte aktuální stav leadu.',
            'status.in'                 => 'Vybraný stav je neplatný.',
        ];
    }
}