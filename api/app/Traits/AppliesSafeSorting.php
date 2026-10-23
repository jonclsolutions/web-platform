<?php
/**
 * @file AppliesSafeSorting.php
 * @path app/Traits/AppliesSafeSorting.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-23
 * @description Shared, safe `sort_by` / `sort_direction` handling of the index endpoints. The
 *   requested column is accepted only when it is a real column of the queried table (or an
 *   explicitly allowed extra key), the direction only as `asc` / `desc`; anything else falls
 *   back to the endpoint's default sorting. Before, the raw query values went straight into
 *   `orderBy()` - an unknown column or direction answered 500 (open finding #5; no injection,
 *   identifiers are quoted, but it was an easy error / log-flooding vector).
 * @dependencies
 * - Illuminate\Support\Facades\Schema: column listing of the table (cached per request).
 */

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

trait AppliesSafeSorting
{
    /** @var array<string, string[]> Column listing per table (per request / process). */
    private static array $sortableColumnCache = [];

    /**
     * @description Resolves the requested sort column and direction.
     * @param Request $request Index request (`sort_by`, `sort_direction`).
     * @param string $table Table whose columns may be sorted by.
     * @param string $defaultColumn Column used when the request has none / an invalid one.
     * @param string $defaultDirection Direction used when the request has none / an invalid one.
     * @param string[] $extra Additional allowed keys (e.g. a joined alias handled by the caller).
     * @return array{0: string, 1: string} [column, direction]
     */
    protected function resolveSorting(Request $request, string $table, string $defaultColumn, string $defaultDirection = 'desc', array $extra = []): array
    {
        $columns = self::$sortableColumnCache[$table] ??= Schema::getColumnListing($table);

        $column = (string) $request->input('sort_by', $defaultColumn);
        if (str_starts_with($column, "{$table}.")) {
            $column = substr($column, strlen($table) + 1);  // "users.full_name" = "full_name"
        }
        if (!in_array($column, $columns, true) && !in_array($column, $extra, true)) {
            $column = $defaultColumn;
        }

        $direction = strtolower((string) $request->input('sort_direction', $defaultDirection));
        if (!in_array($direction, ['asc', 'desc'], true)) {
            $direction = strtolower($defaultDirection);
        }

        return [$column, $direction];
    }

    /**
     * @description Applies the resolved sorting to an Eloquent query of the model's table
     *   (column qualified with the table name, safe with joins).
     * @param Builder $query Index query.
     * @param Request $request Index request.
     * @param string $defaultColumn Default column.
     * @param string $defaultDirection Default direction.
     * @return Builder The same query.
     */
    protected function applySorting(Builder $query, Request $request, string $defaultColumn, string $defaultDirection = 'desc'): Builder
    {
        $table = $query->getModel()->getTable();
        [$column, $direction] = $this->resolveSorting($request, $table, $defaultColumn, $defaultDirection);

        return $query->orderBy("{$table}.{$column}", $direction);
    }
}
