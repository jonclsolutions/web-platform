<?php
/**
 * @file WebNewsResource.php
 * @path app/Http/Resources/Web/WebNewsResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Resource transformation for website news articles.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @description Transforms WebNews model data into a structured format for news feed rendering.
 */
class WebNewsResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'title'      => $this->title,
            'message'    => $this->message,
            'author'     => $this->author,
            'thema'      => $this->thema,
            'bullet_1'   => $this->bullet_1,
            'bullet_2'   => $this->bullet_2,
            'bullet_3'   => $this->bullet_3,
            'bullet_4'   => $this->bullet_4,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at' => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}