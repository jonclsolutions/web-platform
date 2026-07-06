<?php
/**
 * @file WebRawRequestCommission.php
 * @path app/Models/Web/WebRawRequestCommission.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model representing raw commission requests submitted from the web.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @description Handles raw commission inquiry submissions, preserving contact info and order details.
 * * @property int $id Unique identifier.
 * @property string $thema Subject of the commission.
 */
class WebRawRequestCommission extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * @var bool Indicates if the model should be timestamped.
     */
    public $timestamps = true;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'thema',
        'contact_email',
        'contact_phone',
        'order_description',
        'status',
        'priority',
        'note',
        'file_path',
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