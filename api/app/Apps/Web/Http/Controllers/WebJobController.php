<?php

/**
 * @file WebJobController.php
 * @path app/Apps/Web/Http/Controllers/WebJobController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Open positions of the public website (Careers): the preview of the list (title,
 * short description), the type and place of work and the blocks of the detail (optional heading
 * + text), every text per language. Admin (web/edit-website, tab Jobs): all positions are read
 * and saved at once - positions / blocks missing in the request are deleted, the order of the
 * request is the order on the website. Public: the active positions only.
 * @note Texts are plain text (I18nText) - the website shows them as text, never as HTML.
 * @note `slug` is the URL of the detail (/jobs/{slug}) - lower-case letters, digits and hyphens.
 * @dependencies WebJob, WebJobSection, WebLog (audit log), I18nText.
 */

namespace App\Apps\Web\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Apps\Web\Models\WebJob;
use App\Apps\Web\Models\WebJobSection;
use App\Apps\Web\Models\WebLog;
use App\Support\I18n\I18nText;
use App\Apps\Web\Support\WebContentLanguages;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WebJobController extends Controller
{
    use LogsActivity;

    /** @description Allowed URL of a position. */
    public const SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** @description Limits of one save (protection against oversized payloads). */
    private const MAX_JOBS = 50;
    private const MAX_SECTIONS_PER_JOB = 30;

    /** @description Maximum characters per language. */
    private const MAX_TITLE = 150;
    private const MAX_SUMMARY = 500;
    private const MAX_META = 80;
    private const MAX_HEADING = 150;
    private const MAX_BODY = 5000;

    /**
     * @description All positions for the admin (also the inactive ones).
     * @return JsonResponse { data: [{ id, slug, is_active, title_i18n, summary_i18n, type_i18n,
     *   location_i18n, sections: [{ id, heading_i18n, body_i18n }] }] }
     */
    public function index(): JsonResponse
    {
        return $this->respond($this->list(false));
    }

    /**
     * @description Saves all positions: updates the sent ones (by id), creates the new ones (no
     *   id) and deletes the ones that were not sent; the same for the blocks of every position.
     * @param Request $request { jobs: [{ id?, slug, is_active, title_i18n, summary_i18n, type_i18n,
     *   location_i18n, sections: [{ id?, heading_i18n, body_i18n }] }] }
     * @return JsonResponse The fresh positions (as index()); 422 when an id does not exist any
     *   more or a URL is used twice.
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate(array_merge(
            [
                'jobs'                 => ['present', 'array', 'max:' . self::MAX_JOBS],
                'jobs.*.id'            => ['nullable', 'integer', 'distinct'],
                'jobs.*.slug'          => ['required', 'string', 'max:80', 'regex:' . self::SLUG_PATTERN, 'distinct'],
                'jobs.*.is_active'     => ['required', 'boolean'],
                'jobs.*.sections'      => ['present', 'array', 'max:' . self::MAX_SECTIONS_PER_JOB],
                'jobs.*.sections.*.id' => ['nullable', 'integer'],
            ],
            I18nText::rules('jobs.*.title_i18n', self::MAX_TITLE),
            I18nText::rules('jobs.*.summary_i18n', self::MAX_SUMMARY),
            I18nText::rules('jobs.*.type_i18n', self::MAX_META),
            I18nText::rules('jobs.*.location_i18n', self::MAX_META),
            I18nText::rules('jobs.*.sections.*.heading_i18n', self::MAX_HEADING),
            I18nText::rules('jobs.*.sections.*.body_i18n', self::MAX_BODY),
        ), [
            'jobs.*.slug.regex'    => 'The URL may contain lower-case letters, digits and hyphens only.',
            'jobs.*.slug.distinct' => 'Every position needs its own URL.',
        ]);

        $jobs = array_values($request->input('jobs', []));
        $jobIds = array_values(array_filter(array_column($jobs, 'id'), fn ($id) => $id !== null));
        $sectionIds = [];
        foreach ($jobs as $job) {
            foreach ($job['sections'] as $section) {
                if (($section['id'] ?? null) !== null) {
                    $sectionIds[] = (int) $section['id'];
                }
            }
        }

        // Every sent id must exist (once) and blocks stay with their position - otherwise the
        // client works with stale data.
        $knownSections = WebJobSection::whereIn('id', $sectionIds)->pluck('job_id', 'id');
        $sectionsMoved = false;
        foreach ($jobs as $job) {
            foreach ($job['sections'] as $section) {
                $id = $section['id'] ?? null;
                if ($id !== null && (int) ($knownSections[(int) $id] ?? 0) !== (int) ($job['id'] ?? -1)) {
                    $sectionsMoved = true;
                }
            }
        }
        if (count($sectionIds) !== count(array_unique($sectionIds))
            || $sectionsMoved
            || WebJob::whereIn('id', $jobIds)->count() !== count($jobIds)) {
            return response()->json(['message' => 'The positions were changed in the meantime. Reload the page.'], 422);
        }

        // Only the languages of the web module (a page opened before a language was deleted
        // must not store it again).
        $languages = WebContentLanguages::codes();

        DB::transaction(function () use ($languages, $jobs, $jobIds, $sectionIds) {
            WebJobSection::whereNotIn('id', $sectionIds)->delete();
            WebJob::whereNotIn('id', $jobIds)->delete();

            // Two positions may swap their URLs in one save: free the URLs first (unique index).
            foreach ($jobIds as $id) {
                WebJob::whereKey($id)->update(['slug' => 'tmp-' . $id . '-' . Str::lower(Str::random(12))]);
            }

            foreach ($jobs as $jobIndex => $data) {
                $job = WebJob::findOrNew($data['id'] ?? null);
                $job->fill([
                    'slug'          => $data['slug'],
                    'is_active'     => (bool) $data['is_active'],
                    'title_i18n'    => I18nText::clean($data['title_i18n'] ?? [], self::MAX_TITLE, false, $languages),
                    'summary_i18n'  => I18nText::clean($data['summary_i18n'] ?? [], self::MAX_SUMMARY, false, $languages),
                    'type_i18n'     => I18nText::clean($data['type_i18n'] ?? [], self::MAX_META, false, $languages),
                    'location_i18n' => I18nText::clean($data['location_i18n'] ?? [], self::MAX_META, false, $languages),
                    'sort_order'    => $jobIndex,
                ])->save();

                foreach (array_values($data['sections']) as $sectionIndex => $sectionData) {
                    WebJobSection::findOrNew($sectionData['id'] ?? null)->fill([
                        'job_id'       => $job->id,
                        'heading_i18n' => I18nText::clean($sectionData['heading_i18n'] ?? [], self::MAX_HEADING, false, $languages),
                        'body_i18n'    => I18nText::clean($sectionData['body_i18n'] ?? [], self::MAX_BODY, true, $languages),
                        'sort_order'   => $sectionIndex,
                    ])->save();
                }
            }
        });

        // The texts themselves are not copied into the log (only the URLs).
        $this->logAction($request, WebLog::class, 'update', 'Web', 'Updated the open positions: ' . (implode(', ', array_column($jobs, 'slug')) ?: 'none'), null, 'WebJob', ['jobs']);

        return $this->respond($this->list(false));
    }

    /**
     * @description The active positions for the public website (texts per language, empty
     *   languages left out).
     * @return JsonResponse { data: [{ slug, title, summary, type, location, sections: [{ heading, body }] }] }
     */
    public function publicIndex(): JsonResponse
    {
        $jobs = array_map(fn (array $job) => [
            'slug'     => $job['slug'],
            'title'    => $job['title_i18n'],
            'summary'  => $job['summary_i18n'],
            'type'     => $job['type_i18n'],
            'location' => $job['location_i18n'],
            'sections' => array_map(fn (array $section) => [
                'heading' => $section['heading_i18n'],
                'body'    => $section['body_i18n'],
            ], $job['sections']),
        ], $this->list(true));

        return $this->respond($jobs);
    }

    /**
     * @description Positions with their blocks in the order of the website.
     * @param bool $activeOnly Only the positions shown on the website.
     * @return array<int, array>
     */
    private function list(bool $activeOnly): array
    {
        return WebJob::with('sections')
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn (WebJob $job) => [
                'id'            => $job->id,
                'slug'          => $job->slug,
                'is_active'     => (bool) $job->is_active,
                'title_i18n'    => (object) ($job->title_i18n ?? []),
                'summary_i18n'  => (object) ($job->summary_i18n ?? []),
                'type_i18n'     => (object) ($job->type_i18n ?? []),
                'location_i18n' => (object) ($job->location_i18n ?? []),
                'sections'      => $job->sections->map(fn (WebJobSection $section) => [
                    'id'           => $section->id,
                    'heading_i18n' => (object) ($section->heading_i18n ?? []),
                    'body_i18n'    => (object) ($section->body_i18n ?? []),
                ])->all(),
            ])->all();
    }
}
