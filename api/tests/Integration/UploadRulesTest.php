<?php

/**
 * @file UploadRulesTest.php
 * @path api/tests/Integration/UploadRulesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of GET /api/upload-rules (UploadRulesController) and of the
 *   AttachmentPolicy profiles it publishes.
 * @dependencies
 * - Tests\TestCase; App\Support\Uploads\AttachmentPolicy.
 */

namespace Tests\Integration;

use App\Apps\Web\WebApp;
use App\Support\Uploads\AttachmentPolicy;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * @description GET /api/upload-rules and AttachmentPolicy.
 */
class UploadRulesTest extends TestCase
{
    /**
     * @description The endpoint is public and returns every profile with the same values the
     *   requests validate with; no profile allows a format a browser runs as a page.
     * @input GET /api/upload-rules without login.
     * @output 200; profiles raw_request_commission, sales_order, job_application,
     *   project_thread; e.g. sales_order {max_files 10, 20 MB, 50 MB}, project_thread {5, 15 MB,
     *   total null}; equal to AttachmentPolicy::publicRules(); no svg / html / xml anywhere.
     */
    public function test_public_rules(): void
    {
        $data = $this->getJson('/api/upload-rules')->assertOk()->json('data');

        $this->assertSame(['raw_request_commission', 'sales_order', 'job_application', 'project_thread'], array_keys($data));
        $this->assertSame(AttachmentPolicy::publicRules(), $data);
        $this->assertSame(['max_files' => 10, 'max_file_size_mb' => 20, 'max_total_size_mb' => 50], array_diff_key($data['sales_order'], ['extensions' => 0]));
        $this->assertSame(['max_files' => 5, 'max_file_size_mb' => 15, 'max_total_size_mb' => null], array_diff_key($data['project_thread'], ['extensions' => 0]));
        $this->assertContains('pdf', $data['job_application']['extensions']);
        foreach ($data as $profile => $rules) {
            $this->assertEmpty(array_intersect($rules['extensions'], ['svg', 'html', 'htm', 'xml', 'xhtml', 'js', 'php']), $profile);
        }
    }

    /**
     * @description The per-file rules check size, content type and name; an unknown profile is a
     *   programming error.
     * @input fileRules(job_application); profile('nope').
     * @output ['file', 'max:20480', 'mimes:…', 'extensions:…'] with the same list; InvalidArgumentException.
     */
    public function test_file_rules_and_unknown_profile(): void
    {
        $list = implode(',', AttachmentPolicy::profile(WebApp::UPLOAD_JOB_APPLICATION)['extensions']);
        $this->assertSame(['file', 'max:20480', 'mimes:' . $list, 'extensions:' . $list], AttachmentPolicy::fileRules(WebApp::UPLOAD_JOB_APPLICATION));

        $this->expectException(InvalidArgumentException::class);
        AttachmentPolicy::profile('nope');
    }
}
