<?php

/**
 * @file CspReportController.php
 * @path app/Http/Controllers/Api/CspReportController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Receives the violation reports of the Content-Security-Policy of the SPA
 * (`report-uri /api/csp-report` in deploy/server/.htaccess) and records them as the security
 * event `csp_violation`, so the admin sees in Security events when the policy blocks something -
 * an attempted script injection, or a legitimate source the policy is missing.
 * @security Public (the browser sends the reports without any session) and throttled by the
 * route. Only a minimal, data-free summary is stored (GDPR data minimisation): the violated
 * directive, the ORIGIN of the blocked resource (no path / query) or the keyword 'inline' / 'eval',
 * and the first path segment of the page - never the full URL, which could carry a token
 * (e.g. the project portal link). The answer is always 204, so the endpoint tells nothing.
 */

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreSecurityEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CspReportController extends Controller
{
    /** @description Largest report body that is read at all (bytes) - a report is a few hundred bytes. */
    private const MAX_BODY_BYTES = 8192;

    /**
     * @description Records one CSP violation report (application/csp-report or application/reports+json).
     * @param Request $request Report sent by the browser.
     * @return Response 204 in every case.
     */
    public function store(Request $request): Response
    {
        $body = $request->getContent();
        if ($body === '' || strlen($body) > self::MAX_BODY_BYTES) {
            return response()->noContent();
        }

        $report = $this->extractReport(json_decode($body, true));
        if ($report !== null) {
            CoreSecurityEvent::record(
                'csp_violation',
                'info',
                $request->ip(),
                CoreSecurityEvent::contextFromRequest($request, [
                    'directive' => $this->clean($report['effective-directive'] ?? $report['effectiveDirective'] ?? $report['violated-directive'] ?? null),
                    'blocked'   => $this->blockedSource($report['blocked-uri'] ?? $report['blockedURL'] ?? null),
                    'page'      => $this->pageSection($report['document-uri'] ?? $report['documentURL'] ?? null),
                ])
            );
        }

        return response()->noContent();
    }

    /**
     * @description The report object of both formats: the classic `{ "csp-report": {...} }` and
     * the Reporting API list `[{ "type": "csp-violation", "body": {...} }]`.
     * @param mixed $decoded Decoded JSON body.
     * @return array<string, mixed>|null
     */
    private function extractReport(mixed $decoded): ?array
    {
        if (!is_array($decoded)) {
            return null;
        }
        if (isset($decoded['csp-report']) && is_array($decoded['csp-report'])) {
            return $decoded['csp-report'];
        }
        $first = $decoded[0] ?? null;
        if (is_array($first) && ($first['type'] ?? null) === 'csp-violation' && is_array($first['body'] ?? null)) {
            return $first['body'];
        }

        return null;
    }

    /**
     * @description Origin of the blocked resource, or the keyword of a blocked inline script /
     * style / eval - never its path or query.
     * @param mixed $uri `blocked-uri` of the report.
     * @return string|null
     */
    private function blockedSource(mixed $uri): ?string
    {
        if (!is_string($uri) || $uri === '') {
            return null;
        }
        if (in_array($uri, ['inline', 'eval', 'self', 'data', 'blob', 'wasm-eval', 'trusted-types-policy'], true)) {
            return $uri;
        }
        $parts = parse_url($uri);
        if (!isset($parts['scheme'])) {
            return $this->clean($uri);
        }

        return $this->clean($parts['scheme'] . (isset($parts['host']) ? '://' . $parts['host'] : ':'));
    }

    /**
     * @description First path segment of the page ('/admin', '/projects', '/') - enough to see
     * where it happened, without tokens or ids of the URL.
     * @param mixed $uri `document-uri` of the report.
     * @return string|null
     */
    private function pageSection(mixed $uri): ?string
    {
        if (!is_string($uri)) {
            return null;
        }
        $path = (string) parse_url($uri, PHP_URL_PATH);
        $segment = explode('/', trim($path, '/'))[0] ?? '';

        return $this->clean('/' . $segment);
    }

    /**
     * @description Keeps only printable characters and shortens the value.
     * @param mixed $value Value of the report.
     * @return string|null
     */
    private function clean(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return null;
        }

        return mb_substr((string) preg_replace('/[^\x20-\x7E]/', '', $value), 0, 60);
    }
}
