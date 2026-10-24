<?php

/**
 * @file ResponseEnvelopeTest.php
 * @path api/tests/Unit/Other/ResponseEnvelopeTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-24
 * @description Tests of the one response envelope of the API (open finding #6): the
 *   RespondsWithData trait (`{data, meta?, message?}`, pagination meta, resources resolved) and
 *   an architecture check that no controller / middleware builds a success shape by hand.
 * @dependencies
 * - Tests\TestCase; App\Traits\RespondsWithData; a tiny JsonResource and LengthAwarePaginator.
 */

namespace Tests\Unit\Other;

use App\Traits\RespondsWithData;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Pagination\LengthAwarePaginator;
use Tests\TestCase;

/**
 * @description App\Traits\RespondsWithData + the controller source rules.
 */
class ResponseEnvelopeTest extends TestCase
{
    /**
     * @description Object using the trait with public wrappers of the protected methods.
     * @return object
     */
    private function responder(): object
    {
        return new class {
            use RespondsWithData;

            /** @return \Illuminate\Http\JsonResponse */
            public function one(mixed $data, int $status = 200, array $meta = [], ?string $message = null)
            {
                return $this->respond($data, $status, $meta, $message);
            }

            /** @return \Illuminate\Http\JsonResponse */
            public function page(LengthAwarePaginator $page, ?string $resource = null, array $meta = [])
            {
                return $this->respondPaginated($page, $resource, $meta);
            }
        };
    }

    /**
     * @description A record, a list and plain data are wrapped in `data`; meta and message are
     *   added only when given; a resource (also nested in an array) is resolved to its fields.
     * @input one(resource, 201); one([resource list]); one(['n' => 1], 200, ['x' => true], 'Done'); one([]).
     * @output {data:{id,label}} 201; {data:[{…}]}; {data:{n:1}, meta:{x:true}, message:'Done'}; {data:[]}.
     */
    public function test_respond_wraps_the_payload(): void
    {
        $resource = new class(['id' => 7, 'secret' => 'x']) extends JsonResource {
            public function toArray($request): array
            {
                return ['id' => $this->resource['id'], 'label' => "#{$this->resource['id']}"];
            }
        };
        $r = $this->responder();

        $created = $r->one($resource, 201);
        $this->assertSame(201, $created->getStatusCode());
        $this->assertSame(['data' => ['id' => 7, 'label' => '#7']], $created->getData(true));

        $this->assertSame(['data' => ['item' => ['id' => 7, 'label' => '#7']]], $r->one(['item' => $resource])->getData(true));
        $this->assertSame(
            ['data' => ['n' => 1], 'meta' => ['x' => true], 'message' => 'Done'],
            $r->one(['n' => 1], 200, ['x' => true], 'Done')->getData(true)
        );
        $this->assertSame(['data' => []], $r->one([])->getData(true));
    }

    /**
     * @description A page answers its items in `data` and the pagination in `meta` (plus extra meta).
     * @input Page 2 of 5 items, 2 per page, with and without a resource class; extra meta {a: 1}.
     * @output data = the 2 items (resource-mapped); meta {total 5, per_page 2, current_page 2, last_page 3, a 1}.
     */
    public function test_respond_paginated(): void
    {
        $page = new LengthAwarePaginator([['id' => 3], ['id' => 4]], 5, 2, 2);
        $body = $this->responder()->page($page, null, ['a' => 1])->getData(true);

        $this->assertSame([['id' => 3], ['id' => 4]], $body['data']);
        $this->assertSame(['total' => 5, 'per_page' => 2, 'current_page' => 2, 'last_page' => 3, 'a' => 1], $body['meta']);

        $mapped = $this->responder()->page($page, EnvelopeTestResource::class)->getData(true);
        $this->assertSame([['ref' => 'r3'], ['ref' => 'r4']], $mapped['data']);
        $this->assertArrayNotHasKey('a', $mapped['meta']);
    }

    /**
     * @description Architecture rule: controllers and middleware answer success payloads only
     *   through respond() / respondPaginated(). A literal `response()->json(…)` may carry only an
     *   error / message shape (`message`, `errors`, `error_code`, `retry_after`, `captcha_required`)
     *   or null (204);
     *   resources, variables (bare models), `data` keys and `success` flags are forbidden.
     * @input Source of every file in app/Http/Controllers and app/Http/Middleware.
     * @output No violation (the list of violations is printed on failure).
     */
    public function test_no_hand_built_success_shapes(): void
    {
        $allowed = ['message', 'errors', 'error_code', 'retry_after', 'captcha_required'];
        $violations = [];
        $files = array_merge(
            glob(app_path('Http/Controllers/**/*.php')) ?: [],
            glob(app_path('Http/Controllers/*.php')) ?: [],
            glob(app_path('Http/Middleware/*.php')) ?: []
        );

        foreach ($files as $file) {
            // Comments removed (blanked, line numbers kept) - they may quote old code.
            $source = preg_replace_callback('#/\*.*?\*/|//[^\n]*#s', fn ($m) => preg_replace('/[^\n]/', ' ', $m[0]), file_get_contents($file));
            if (preg_match_all('/response\(\)->json\(\s*(.)/', $source, $calls, PREG_OFFSET_CAPTURE)) {
                foreach ($calls[1] as [$first, $offset]) {
                    $line = substr_count(substr($source, 0, $offset), "\n") + 1;
                    $rest = substr($source, $offset, 400);
                    if (str_starts_with($rest, 'null')) {
                        continue;
                    }
                    if ($first !== '[') {
                        $violations[] = basename($file) . ":{$line} non-literal payload";
                        continue;
                    }
                    preg_match_all("/'(\\w+)'\\s*=>/", $this->topLevel($rest), $keys);
                    foreach ($keys[1] as $key) {
                        if (!in_array($key, $allowed, true)) {
                            $violations[] = basename($file) . ":{$line} key '{$key}'";
                        }
                    }
                }
            }
        }

        $this->assertSame([], $violations, "Success payloads must use respond():\n" . implode("\n", $violations));
    }

    /**
     * @description Cuts the first array literal of `$code` to its top level (nested arrays /
     *   calls / strings removed), so only its own keys are checked.
     * @param string $code Source starting with '['.
     * @return string Top-level text of the literal.
     */
    private function topLevel(string $code): string
    {
        $depth = 0;
        $out = '';
        $quote = null;
        for ($i = 0, $n = strlen($code); $i < $n; $i++) {
            $c = $code[$i];
            if ($quote !== null) {
                if ($c === '\\') {
                    $i++;
                } elseif ($c === $quote) {
                    $quote = null;
                }
                if ($depth === 1) {
                    $out .= $c;
                }
                continue;
            }
            if ($c === "'" || $c === '"') {
                $quote = $c;
            } elseif ($c === '[' || $c === '(') {
                $depth++;
                if ($depth === 1) {
                    $out .= $c;
                    continue;
                }
            } elseif ($c === ']' || $c === ')') {
                $depth--;
                if ($depth === 0) {
                    break;
                }
            }
            if ($depth === 1) {
                $out .= $c;
            }
        }

        return $out;
    }
}

/**
 * @description Minimal resource of the pagination test (maps id → ref).
 */
class EnvelopeTestResource extends JsonResource
{
    /**
     * @param \Illuminate\Http\Request $request
     * @return array<string, string>
     */
    public function toArray($request): array
    {
        return ['ref' => 'r' . $this->resource['id']];
    }
}
