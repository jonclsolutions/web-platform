<?php
/**
 * @file DocumentType.php
 * @path app/Models/Legal/DocumentType.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing a type of legal document (e.g., TOS, Privacy Policy).
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @description Defines the category/type of legal documents to organize related sections.
 * 
 * @property int $id The unique identifier for the document type.
 * @property string $slug The URL-friendly identifier for the document type.
 * @property string $title The human-readable title of the document.
 */
class DocumentType extends Model
{
    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = ['slug', 'title'];

    /**
     * Get the sections associated with this document type.
     *
     * @return HasMany
     */
    public function sections(): HasMany
    {
        return $this->hasMany(DocumentSection::class);
    }
}