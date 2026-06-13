<?php
namespace App\Http\Requests\Legal\Config;
use Illuminate\Foundation\Http\FormRequest;

class StoreSocialLinkRequest extends FormRequest {
    public function authorize() { return true; }
    public function rules() {
        return [
            'name' => 'required|string',
            'url' => 'required|url',
            'icon_path' => 'required|string',
            'position' => 'integer'
        ];
    }
}