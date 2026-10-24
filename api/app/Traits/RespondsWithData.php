<?php
/**
 * @file RespondsWithData.php
 * @path app/Traits/RespondsWithData.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-24
 * @description The ONE response envelope of the API (open finding #6). Every successful answer
 *   that carries a payload is `{ "data": … }`, optionally with `"meta": { … }` beside it:
 *   - one record / result  → `{ data: {…} }`            (`respond()`, 201 via `$status`)
 *   - list                 → `{ data: [ … ] }`          (`respond()` with a collection)
 *   - paginated list       → `{ data: [ … ], meta: { total, per_page, current_page, last_page } }`
 *                            (`respondPaginated()`)
 *   - extra information    → `meta` (e.g. `activation_email_sent`), never mixed into `data`
 *   - optional `message`   → human-readable hint beside `data` (same key as in errors)
 *   Answers WITHOUT a payload stay `204` (no body) or `{ message }`; errors stay the Laravel
 *   shape `{ message, errors? }` (+ optional `error_code`) and are never wrapped.
 * @note Why one envelope: the frontend unwraps `data` without guessing, new meta fields never
 *   change the shape of the payload, and the top-level JSON is always an object. Before, every
 *   controller decided itself (`response()->json(new Resource)` = bare, manual `['data' => …]`,
 *   flat pagination keys, own keys like `titles` / `languages` / `status`).
 *   Records always go through an API Resource (explicit field list) - never a bare model.
 * @dependencies
 * - Illuminate\Http\Resources\Json\JsonResource: resolved with the current request.
 */

namespace App\Traits;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;

trait RespondsWithData
{
    /**
     * @description Answers `{ data, meta?, message? }`.
     * @param mixed $data Resource, resource collection, array or scalar payload.
     * @param int $status HTTP status (200, 201 for a created record, …).
     * @param array<string, mixed> $meta Extra information beside the payload (omitted when empty).
     * @param string|null $message Optional human-readable hint (English, the frontend shows its
     *   own translation; omitted when null) - the same key as in error answers.
     * @return JsonResponse
     */
    protected function respond(mixed $data, int $status = 200, array $meta = [], ?string $message = null): JsonResponse
    {
        $body = ['data' => $this->resolvePayload($data)];
        if ($meta !== []) {
            $body['meta'] = $meta;
        }
        if ($message !== null) {
            $body['message'] = $message;
        }

        return response()->json($body, $status);
    }

    /**
     * @description Answers a page: `{ data: [ … ], meta: { total, per_page, current_page, last_page } }`.
     * @param LengthAwarePaginator $page Paginator of the query.
     * @param class-string<JsonResource>|null $resource Resource of one item (null = items as they are).
     * @param array<string, mixed> $meta Extra meta merged after the pagination keys.
     * @return JsonResponse
     */
    protected function respondPaginated(LengthAwarePaginator $page, ?string $resource = null, array $meta = []): JsonResponse
    {
        $items = $resource ? $resource::collection($page->items()) : $page->items();

        return $this->respond($items, 200, array_merge([
            'total'        => $page->total(),
            'per_page'     => $page->perPage(),
            'current_page' => $page->currentPage(),
            'last_page'    => $page->lastPage(),
        ], $meta));
    }

    /**
     * @description Resolves resources (also nested in arrays) to plain arrays with the current request.
     * @param mixed $data Payload.
     * @return mixed
     */
    private function resolvePayload(mixed $data): mixed
    {
        if ($data instanceof JsonResource) {
            return $data->resolve(request());
        }
        if (is_array($data)) {
            return array_map(fn ($value) => $this->resolvePayload($value), $data);
        }

        return $data;
    }
}
