<?php

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model {
    protected $table = 'legal_site_settings';
    
    // Přidáváme logo_path do fillable
    protected $fillable = [
        'company_name', 'ico', 'dic', 'contact_email', 
        'contact_phone', 'address', 'footer_text', 'logo_path'
    ];
}