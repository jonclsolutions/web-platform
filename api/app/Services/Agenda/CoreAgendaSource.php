<?php
/**
 * @file CoreAgendaSource.php
 * @path app/Services/Agenda/CoreAgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar entries of the core: expiry of account activation links (events) and new
 * security events (reminder).
 * @dependencies AccountActivationToken, User, CoreSecurityEvent
 */

namespace App\Services\Agenda;

use App\Models\AccountActivationToken;
use App\Models\Core\CoreSecurityEvent;
use App\Models\User;
use Illuminate\Support\Carbon;

final class CoreAgendaSource implements AgendaSource
{
    /** @description See AgendaSource::permissions(). */
    public function permissions(): array
    {
        return ['core-administrators-view', 'core-security-view'];
    }

    /** @description See AgendaSource::events(). */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array
    {
        $events = [];
        if ($agenda->can('core-administrators-view')) {
            $tokens = AccountActivationToken::whereBetween('expires_at', [$from, $to])
                ->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get(['id', 'user_id', 'expires_at']);
            $users = User::whereIn('id', $tokens->pluck('user_id'))->whereNull('activated_at')->pluck('user_email', 'id');
            foreach ($tokens as $token) {
                if (isset($users[$token->user_id])) {
                    $events[] = $agenda->event('activation_expiry', (string) $token->id, $token->expires_at, (string) $users[$token->user_id], '/admin/core/administrators', 'warning');
                }
            }
        }

        return $events;
    }

    /** @description See AgendaSource::reminders(). */
    public function reminders(AgendaContext $agenda): array
    {
        return array_values(array_filter([
            $agenda->can('core-security-view') ? $agenda->reminder('security_events_new', '/admin/core/security-events', CoreSecurityEvent::where('status', 'new')) : null,
        ]));
    }
}
