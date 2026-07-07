<?php
/**
 * @file DocumentSection.php
 * @path app/Models/Legal/DocumentSection.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing a section within a legal document.
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @description Manages content sections for various legal documents, supporting multi-language content.
 * 
 * @property int $id The unique identifier for the document section.
 * @property int $document_type_id The ID of the parent document type.
 * @property int $position The display order index for the section.
 * @property string $heading The title or heading of the section.
 * @property string $content The body content of the section.
 * @property string $lang The language code for the section content.
 */
class DocumentSection extends Model
{
    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'document_type_id', 
        'position', 
        'heading', 
        'content', 
        'lang'
    ];

    /**
     * Get the document type that owns this section.
     *
     * @return BelongsTo
     */
    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }
}