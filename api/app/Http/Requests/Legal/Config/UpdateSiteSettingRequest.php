<?php
namespace App\Http\Requests\Legal\Config;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSiteSettingRequest extends FormRequest {
    public function authorize() { return true; }
    public function rules() {
        return [
            'company_name' => 'required|string',
            'ico' => 'required|string',
            'dic' => 'nullable|string',
            'contact_email' => 'required|email',
            'contact_phone' => 'nullable|string',
            'address' => 'required|string',
            'footer_text' => 'nullable|string',
        ];
    }
}