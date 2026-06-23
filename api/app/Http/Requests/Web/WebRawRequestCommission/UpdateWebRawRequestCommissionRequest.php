<?php
namespace App\Http\Requests\Web\WebRawRequestCommission;
use Illuminate\Foundation\Http\FormRequest;

class UpdateWebRawRequestCommissionRequest extends FormRequest
{
    use ValidatesAttachmentSecurity;

public function authorize(): bool
    {
return true;
    }

public function rules(): array
    {
return [
// Sjednoceno s Angular patternem: povolená česká diakritika, čísla, tečky, pomlčky, mezery
'thema'             => ['sometimes', 'string', 'min:3', 'max:255', 'regex:/^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\s\.\-]+$/u'],
'contact_email'     => ['sometimes', 'email', 'max:255'],
// Sjednoceno s Angular patternem pro validní telefonní čísla
'contact_phone'     => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
'order_description' => ['sometimes', 'string', 'max:10000'],
'status'            => ['sometimes', 'string', 'in:Nově zadané,Zpracovává se,Dokončeno,Zrušeno'],
'priority'          => ['sometimes', 'string', 'in:Nízká,Neutrální,Vysoká'],
'note'              => ['sometimes', 'nullable', 'string'],
// Příloha: blacklist přístup - povoleno cokoliv kromě spustitelných/škodlivých typů (.exe, .bat, .sh, .apk, ...)
'attachment'        => ['sometimes', 'nullable', 'file', 'max:10240', $this->attachmentExtensionRule()],
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
'thema.min'                     => 'Téma musí mít 3-255 znaků.',
'thema.max'                     => 'Téma musí mít 3-255 znaků.',
'thema.regex'                   => 'Téma obsahuje nepovolené znaky.',
'contact_email.email'           => 'Zadejte platnou e-mailovou adresu.',
'contact_phone.regex'           => 'Zadejte platné telefonní číslo.',
'order_description.max'         => 'Popis požadavku je příliš dlouhý.',
'attachment.max'                => 'Soubor je příliš velký. Maximální velikost je 10 MB.',
'attachment.file'               => 'Příloha musí být platný soubor.',
        ];
    }
}