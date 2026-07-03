<?php
namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentSection extends Model
{
    // Přidej 'lang' do tohoto pole:
    protected $fillable = [
        'document_type_id', 
        'position', 
        'heading', 
        'content', 
        'lang' // <--- ZDE
    ];

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }
}