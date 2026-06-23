<?php
namespace App\Http\Requests\Web\WebRawRequestCommission;
use Illuminate\Foundation\Http\FormRequest;

class StoreWebRawRequestCommissionRequest extends FormRequest
{
    use ValidatesAttachmentSecurity;

public function authorize(): bool
    {
return true;
    }

public function rules(): array
    {
return [
// Regex odpovídá tomu z Angularu (písmena včetně CZ diakritiky, čísla, tečky, pomlčky, mezery)
'thema'             => ['required', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-]+$/u'],
'contact_email'     => ['required', 'email', 'max:255'],
// Regex pro mezinárodní i lokální formát telefonu (např. +420 123 456 789 nebo 777111222)
'contact_phone'     => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
'order_description' => ['required', 'string', 'max:10000'],
'status'            => ['sometimes', 'string', 'in:Nově zadané,Zpracovává se,Dokončeno,Zrušeno'],
'priority'          => ['sometimes', 'string', 'in:Nízká,Neutrální,Vysoká'],
'note'              => ['nullable', 'string'],
// Příloha: blacklist přístup - povoleno cokoliv kromě spustitelných/škodlivých typů (.exe, .bat, .sh, .apk, ...)
'attachment'        => ['nullable', 'file', 'max:10240', $this->attachmentExtensionRule()],
        ];
    }

    /**
     * Doplňková kontrola MIME typu - chrání i proti přejmenovanému spustitelnému souboru.
     */
    public function withValidator($validator)
    {
        $validator->after(fn ($v) => $this->validateAttachmentMime($v));
    }

public function messages(): array
    {
return [
'thema.required'                => 'Téma musí mít 3-255 znaků.',
'thema.min'                     => 'Téma musí mít 3-255 znaků.',
'thema.max'                     => 'Téma musí mít 3-255 znaků.',
'thema.regex'                   => 'Téma obsahuje nepovolené znakky.',
'contact_email.required'        => 'Zadejte platnou e-mailovou adresu.',
'contact_email.email'           => 'Zadejte platnou e-mailovou adresu.',
'contact_phone.regex'           => 'Zadejte platné telefonní číslo.',
'order_description.required'    => 'Popis je povinný pro zpracování.',
'attachment.max'                => 'Soubor je příliš velký. Maximální velikost je 10 MB.',
'attachment.file'               => 'Příloha musí být platný soubor.',
        ];
    }
}