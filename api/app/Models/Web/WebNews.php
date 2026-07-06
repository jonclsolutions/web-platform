<?php
/**
 * @file WebNews.php
 * @path app/Models/Web/WebNews.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing a news article or announcement.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @description Manages news content and bullet points for the website's news feed.
 * * @property int $id Unique identifier.
 * @property string $title Article title.
 */
class WebNews extends Model
{
    use HasFactory, SoftDeletes;
    
    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'message',
        'author',
        'thema',
        'bullet_1',
        'bullet_2',
        'bullet_3',
        'bullet_4'
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}