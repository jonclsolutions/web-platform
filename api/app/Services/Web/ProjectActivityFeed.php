<?php
/**
 * @file ProjectActivityFeed.php
 * @path app/Services/Web/ProjectActivityFeed.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description What happened in a project, newest first, built from the data itself (no extra
 *   table): published updates, checkpoint status changes, approval requests and decisions,
 *   messages. Two audiences:
 *   - client (portal "What is new"): the supplier's side only - updates, checkpoint changes,
 *     approval requests, supplier replies (never internal notes or cancelled requests);
 *   - team (administration overview): the client's side - client messages / new threads and
 *     approval decisions - plus updates and checkpoint changes.
 *   Each item: type, at, title, detail, target {section, id}.
 * @dependencies WebProject and its threads, messages, checkpoints, updates, approvals
 */

namespace App\Services\Web;

use App\Models\Web\{WebProject, WebProjectApproval, WebProjectApprovalDecision, WebProjectThreadMessage};
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ProjectActivityFeed
{
    public const AUDIENCE_CLIENT = 'client';
    public const AUDIENCE_TEAM = 'team';

    /** @description How far back the feed looks (days). */
    public const WINDOW_DAYS = 90;

    /** Internal key of a client-view decision item: id of the deciding account (never sent out). */
    public const DECIDED_BY_KEY = 'decided_by_account';

    /**
     * @description Items of the feed.
     * @param WebProject $project
     * @param string $audience AUDIENCE_CLIENT | AUDIENCE_TEAM
     * @param int $limit Maximum number of items.
     * @return Collection<int, array{type: string, at: string, title: string, detail: string|null, target: array{section: string, id: int|null}}>
     */
    public function build(WebProject $project, string $audience, int $limit = 30): Collection
    {
        $since = now()->subDays(self::WINDOW_DAYS);
        $client = $audience === self::AUDIENCE_CLIENT;
        $items = collect();

        foreach ($project->updates()->published()->where('published_at', '>=', $since)->limit($limit)->get() as $update) {
            $items->push($this->item('update', $update->published_at, $update->title, $update->author_label, 'updates', $update->id));
        }

        foreach ($project->checkpoints()->whereNotNull('status_changed_at')->where('status_changed_at', '>=', $since)->get() as $checkpoint) {
            $items->push($this->item('checkpoint', $checkpoint->status_changed_at, $checkpoint->label, $checkpoint->status, 'checkpoints', $checkpoint->id));
        }

        $approvals = $project->approvals()->where('requested_at', '>=', $since)->visibleToClient()->limit($limit)->get();
        foreach ($approvals as $approval) {
            $items->push($this->item('approval_requested', $approval->requested_at, $approval->title, $approval->requested_by_label, 'approvals', $approval->id));
        }

        $decisions = WebProjectApprovalDecision::whereIn('approval_id', $project->approvals()->select('id'))
            ->where('created_at', '>=', $since)->with('approval:id,title')->latest('id')->limit($limit)->get();
        foreach ($decisions as $decision) {
            $item = $this->item('approval_decided', $decision->created_at, $decision->approval?->title ?? '', $decision->decision, 'approvals', $decision->approval_id, $decision->author_label);
            // Client view: who decided, so the portal does not announce the account's own decision
            // as news (the caller removes the key before answering).
            $items->push($client ? $item + [self::DECIDED_BY_KEY => $decision->account_id] : $item);
        }

        $messages = WebProjectThreadMessage::visibleToClient()
            ->whereIn('thread_id', $project->threads()->select('id'))
            ->where('author_type', $client ? 'admin' : 'customer')
            ->where('created_at', '>=', $since)
            ->with('thread:id,subject')
            ->latest('id')->limit($limit)->get();
        foreach ($messages as $message) {
            $items->push($this->item($client ? 'reply' : 'client_message', $message->created_at, $message->thread?->subject ?? '', $message->author_label, 'threads', $message->thread_id));
        }

        return $items->sortByDesc('at')->take($limit)->values();
    }

    /**
     * @description Number of client items newer than a moment.
     * @param Collection $items Items of build().
     * @param Carbon|null $seenAt Moment the client last looked (null = everything is new).
     * @return int
     */
    public function countNewer(Collection $items, ?Carbon $seenAt): int
    {
        return $items->filter(fn (array $item) => $seenAt === null || $item['at'] > $seenAt->format('Y-m-d H:i:s'))->count();
    }

    /**
     * @description One feed item.
     * @return array<string, mixed>
     */
    private function item(string $type, $at, string $title, ?string $detail, string $section, ?int $id, ?string $actor = null): array
    {
        return [
            'type'   => $type,
            'at'     => Carbon::parse($at)->format('Y-m-d H:i:s'),
            'title'  => $title,
            'detail' => $detail,
            'actor'  => $actor,
            'target' => ['section' => $section, 'id' => $id],
        ];
    }
}
