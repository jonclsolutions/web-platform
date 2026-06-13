<?php
namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentType extends Model
{
    protected $fillable = ['slug', 'title'];

    public function sections(): HasMany
    {
        return $this->hasMany(DocumentSection::class);
    }
}