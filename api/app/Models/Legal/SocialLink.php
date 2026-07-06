<?php
/**
 * @file SocialLink.php
 * @path app/Models/Legal/SocialLink.php
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Model for managing social media link associations.
 */

namespace App\Models\Legal;

use Illuminate\Database\Eloquent\Model;

/**
 * @description Stores links to external social media profiles used across the site footer or contact pages.
 * 
 * @property int $id The unique identifier.
 */
class SocialLink extends Model
{
    /**
     * @var string The table associated with the model.
     */
    protected $table = 'legal_social_links';

    /**
     * @var array<int, mixed> The attributes that aren't mass assignable.
     */
    protected $guarded = [];
}