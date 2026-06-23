<?php
namespace App\Models\Web;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
class WebRawRequestCommission extends Model
{
use HasFactory, SoftDeletes;
public $timestamps = true;
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
protected $casts = [
'created_at' => 'datetime',
'updated_at' => 'datetime',
'deleted_at' => 'datetime',
    ];
}