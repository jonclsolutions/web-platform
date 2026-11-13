<?php
/**
 * @file ProjectPortalRetentionSource.php
 * @path app/Apps/ProjectPortal/Services/ProjectPortalRetentionSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Retention of the project portal (GDPR Art. 5(1)(e)): client projects - deleted for
 *   good with their accounts, sessions, checkpoints, threads, updates, approvals and all files -
 *   plus the portal audit log and the always-run clean-up of expired portal sessions (IP address,
 *   user agent) and used / expired one-time sign-in codes. Registered in
 *   ProjectPortalApp::retentionSources().
 * @note Default period: projects 3650 days (10 years) - contractual relationship; it runs from the
 *   LAST ACTIVITY of a project (a change of the project or a message in one of its threads). The
 *   key `projects` is the same as before, so a saved setting stays valid.
 * @dependencies Portal models, PurgesRecords.
 */

namespace App\Apps\ProjectPortal\Services;

use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectLoginCode;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Services\Retention\PurgesRecords;
use App\Services\Retention\RetentionSource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

final class ProjectPortalRetentionSource implements RetentionSource
{
    use PurgesRecords;

    /** @description See RetentionSource::defaults(). */
    public function defaults(): array
    {
        return ['projects' => 3650];
    }

    /** @description See RetentionSource::purge(). */
    public function purge(string $key, Carbon $cutoff): int
    {
        return match ($key) {
            'projects' => $this->purgeProjects($cutoff),
            default    => throw new InvalidArgumentException("Unknown project portal retention key: {$key}"),
        };
    }

    /** @description See RetentionSource::auditLogModels(). */
    public function auditLogModels(): array
    {
        return [ProjectPortalLog::class];
    }

    /** @description See RetentionSource::cleanUp(). */
    public function cleanUp(): array
    {
        return [
            'expired_portal_sessions' => ProjectSession::where('expires_at', '<', Carbon::now())->delete(),
            // One-time sign-in codes / invitation links: used or expired ones are kept a day (audit of
            // a just finished sign-in), then removed.
            'portal_login_codes'      => ProjectLoginCode::where(fn (Builder $q) => $q
                ->where('expires_at', '<', Carbon::now()->subDay())
                ->orWhere('used_at', '<', Carbon::now()->subDay()))->delete(),
        ];
    }

    /**
     * @description Projects without any activity since the cut-off - neither a change of the
     * project nor a message in one of its threads - with everything that belongs to them.
     * @param Carbon $cutoff Cut-off of the last activity.
     * @return int Number of deleted projects.
     */
    private function purgeProjects(Carbon $cutoff): int
    {
        $query = Project::withTrashed()
            ->where('updated_at', '<', $cutoff)
            ->whereDoesntHave('threads.messages', fn (Builder $q) => $q->where('created_at', '>=', $cutoff))
            ->with('threads.messages.attachments');

        $count = 0;
        $query->chunkById($this->purgeChunk, function ($projects) use (&$count) {
            foreach ($projects as $project) {
                ProjectSession::where('project_id', $project->id)->delete();
                $project->accounts()->delete();
                foreach ($project->approvals()->with('attachments')->get() as $approval) {
                    $this->deleteFiles($approval);
                    $approval->delete();
                }
                foreach ($project->updates()->with('attachments')->get() as $update) {
                    $this->deleteFiles($update);
                    $update->delete();
                }
                $project->checkpoints()->delete();
                foreach ($project->threads as $thread) {
                    foreach ($thread->messages as $message) {
                        $this->deleteFiles($message);
                        $message->delete();
                    }
                    $thread->delete();
                }
                $project->forceDelete();
                $count++;
            }
        });

        return $count;
    }
}
