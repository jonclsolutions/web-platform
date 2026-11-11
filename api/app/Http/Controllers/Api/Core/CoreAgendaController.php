<?php

/**
 * @file CoreAgendaController.php
 * @path app/Http/Controllers/Api/Core/CoreAgendaController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Agenda of the admin calendar (admin: core/calendar) - read only. Collects the
 * dates and the open work the admin already holds, across the modules:
 *   - events (on a day): coupon valid from / until, project deadline, follow-up of a sales lead
 *     (LEAD_FOLLOW_UP_DAYS after the last contact), expiry of an order-form link of a lead,
 *     expiry of an account activation link;
 *   - reminders (open work, counted): new job applicants, unresolved support tickets, new
 *     inquiries, web orders without a project, sales leads without contact, e-shop orders to
 *     process, products at / below their stock warning level, new security events;
 *   - personal events of the logged-in admin (own reminders / notes, CoreCalendarEventController) -
 *     only the own ones, an open one in the past is overdue.
 * Every source is returned only to a user with the view permission of its admin page AND the tab
 * permission of its module (view-web / view-eshop / view-core - like the admin menu; the sysadmin
 * role sees all) - the page itself needs no permission. `modules` lists the modules the user may
 * see (the page shows the filter only for them). Only what the calendar shows is
 * returned (ids, short names, dates), never personal details such as e-mails of applicants.
 * @note The texts are composed by the admin page (type + subject) in the admin language.
 * @dependencies Models of the sources; App\Models\User (permissions, roles).
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\AccountActivationToken;
use App\Models\Core\CoreCalendarEvent;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Shop\ShopCoupon;
use App\Models\Shop\ShopOrder;
use App\Models\Shop\ShopProduct;
use App\Models\User;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebProject;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebSalesOrder;
use App\Models\Web\WebSupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class CoreAgendaController extends Controller
{
    /** @description Longest range of one request (6 weeks of a month view + margin). */
    private const MAX_RANGE_DAYS = 62;

    /** @description A lead without contact for this many days needs a follow-up. */
    public const LEAD_FOLLOW_UP_DAYS = 14;

    /** @description Lead states that need no follow-up (won, lost, handed over, paid). */
    public const LEAD_CLOSED_STATES = ['closed_won', 'closed_lost', 'handed_to_dev_team', 'paid_project_started'];

    /**
     * @description Tab permission of every module (same keys as ADMIN_MODULE_TAB_PERMISSION of
     *   the admin) - without it no source of the module is returned.
     */
    private const MODULE_TAB_PERMISSIONS = ['web' => 'view-web', 'shop' => 'view-eshop', 'core' => 'view-core'];

    /** @description View permissions of the sources of every module (see events() / reminders()). */
    private const MODULE_SOURCES = [
        'web'  => ['web-projects-view', 'web-sales-leads-view', 'web-job-applications-view', 'web-support-tickets-view', 'web-user-requests-view', 'web-sales-orders-view'],
        'shop' => ['shop-coupons-view', 'shop-orders-view', 'shop-products-view'],
        'core' => ['core-administrators-view', 'core-security-view'],
    ];

    /** @description E-shop order states that still need work. */
    public const SHOP_ORDER_OPEN_STATES = ['pending', 'confirmed', 'processing'];

    /** @description Most events of one source in one answer (protection against huge answers). */
    private const MAX_EVENTS_PER_SOURCE = 300;

    /** @var array<int, string>|null Permission keys of the user (null = sysadmin, all). */
    private ?array $permissions = [];

    /**
     * @description Events of the range and the current reminders the user may see.
     * @param Request $request from, to (YYYY-MM-DD; at most MAX_RANGE_DAYS apart).
     * @return JsonResponse { data: { today, modules: ['personal', 'web'|'shop'|'core'...],
     *   events: [{ id, type, module, date, subject, link, severity, personal? }],
     *   reminders: [{ type, module, count, since, link }] } } - personal
     *   events have module 'personal', link null and `personal` (personalEvent()).
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $from = Carbon::createFromFormat('Y-m-d', $validated['from'])->startOfDay();
        $to = Carbon::createFromFormat('Y-m-d', $validated['to'])->endOfDay();
        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            return response()->json(['message' => 'The range may have at most ' . self::MAX_RANGE_DAYS . ' days.', 'errors' => ['to' => ['The range is too long.']]], 422);
        }

        $user = $request->user();
        $this->permissions = $user->roles()->where('role_name', 'sysadmin')->exists() ? null : ($user->permissions ?? []);

        return $this->respond([
            'today'     => now()->toDateString(),
            'modules'   => $this->modules(),
            'events'    => $this->events($from, $to)
                ->merge(CoreCalendarEvent::where('user_id', $user->id)->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                    ->orderBy('time')->limit(self::MAX_EVENTS_PER_SOURCE)->get()->map(fn ($event) => self::personalEvent($event)))
                ->sortBy([['date', 'asc'], ['type', 'asc']])->values()->all(),
            'reminders' => $this->reminders(),
        ]);
    }

    /**
     * @description A personal event in the shape of the agenda.
     * @param CoreCalendarEvent $event Own event.
     * @return array{id: string, type: string, module: string, date: string, subject: string,
     *   link: null, severity: string, personal: array{id: int, time: string|null, note: string|null, done: bool}}
     */
    public static function personalEvent(CoreCalendarEvent $event): array
    {
        $date = $event->date->toDateString();

        return [
            'id'       => "personal-{$event->id}",
            'type'     => 'personal',
            'module'   => 'personal',
            'date'     => $date,
            'subject'  => $event->title,
            'link'     => null,
            'severity' => !$event->is_done && $date < now()->toDateString() ? 'danger' : 'info',
            'personal' => [
                'id'   => $event->id,
                'time' => $event->time ? substr((string) $event->time, 0, 5) : null,
                'note' => $event->note,
                'done' => (bool) $event->is_done,
            ],
        ];
    }

    /**
     * @description May the user see the source: the view permission of its admin page AND the
     *   tab permission of its module (the module = prefix of the key)?
     * @param string $permission View permission key of the source (`web-…`, `shop-…`, `core-…`).
     * @return bool
     */
    private function can(string $permission): bool
    {
        if ($this->permissions === null) {
            return true;
        }
        $tab = self::MODULE_TAB_PERMISSIONS[strstr($permission, '-', true)] ?? null;

        return $tab !== null && in_array($tab, $this->permissions, true) && in_array($permission, $this->permissions, true);
    }

    /**
     * @description Modules the user may see in the calendar: always the own personal events, then
     *   every module with at least one visible source.
     * @return array<int, string>
     */
    private function modules(): array
    {
        $modules = ['personal'];
        foreach (self::MODULE_SOURCES as $module => $keys) {
            if (collect($keys)->contains(fn (string $key) => $this->can($key))) {
                $modules[] = $module;
            }
        }

        return $modules;
    }

    /**
     * @description Dated events of the range.
     * @param Carbon $from Start (inclusive).
     * @param Carbon $to End (inclusive).
     * @return Collection<int, array>
     */
    private function events(Carbon $from, Carbon $to): Collection
    {
        $events = collect();
        $today = now()->startOfDay();
        $event = fn (string $type, string $module, string $id, Carbon $date, string $subject, string $link, string $severity = 'info') => [
            'id' => "{$type}-{$id}", 'type' => $type, 'module' => $module, 'date' => $date->toDateString(),
            'subject' => $subject, 'link' => $link, 'severity' => $severity,
        ];

        if ($this->can('shop-coupons-view')) {
            foreach (ShopCoupon::where('is_active', true)->whereBetween('valid_from', [$from, $to])->limit(self::MAX_EVENTS_PER_SOURCE)->get(['id', 'code', 'valid_from']) as $coupon) {
                $events->push($event('coupon_start', 'shop', (string) $coupon->id, $coupon->valid_from, $coupon->code, '/admin/shop/coupons'));
            }
            foreach (ShopCoupon::where('is_active', true)->whereBetween('valid_until', [$from, $to])->limit(self::MAX_EVENTS_PER_SOURCE)->get(['id', 'code', 'valid_until']) as $coupon) {
                $events->push($event('coupon_end', 'shop', (string) $coupon->id, $coupon->valid_until, $coupon->code, '/admin/shop/coupons', 'warning'));
            }
        }

        if ($this->can('web-projects-view')) {
            $projects = WebProject::where('status', '!=', 'finished')->whereBetween('estimated_completion_to', [$from->toDateString(), $to->toDateString()])
                ->limit(self::MAX_EVENTS_PER_SOURCE)->get(['id', 'name', 'estimated_completion_to']);
            foreach ($projects as $project) {
                $date = Carbon::parse($project->estimated_completion_to);
                $events->push($event('project_deadline', 'web', (string) $project->id, $date, $project->name, "/admin/web/projects?open_project={$project->id}", $date->lt($today) ? 'danger' : 'warning'));
            }
        }

        if ($this->can('web-sales-leads-view')) {
            // Follow-up = last contact + LEAD_FOLLOW_UP_DAYS, so the contacts of the range are shifted back.
            $leads = WebSalesLead::whereNotIn('status', self::LEAD_CLOSED_STATES)
                ->whereBetween('last_contact_date', [$from->copy()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString(), $to->copy()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString()])
                ->limit(self::MAX_EVENTS_PER_SOURCE)->get(['id', 'subject_name', 'last_contact_date']);
            foreach ($leads as $lead) {
                $date = Carbon::parse($lead->last_contact_date)->addDays(self::LEAD_FOLLOW_UP_DAYS);
                $events->push($event('lead_follow_up', 'web', (string) $lead->id, $date, $lead->subject_name, '/admin/web/sales-leads', $date->lt($today) ? 'danger' : 'info'));
            }
            $links = WebSalesLead::whereNotNull('public_token')->whereNull('public_token_used_at')->whereBetween('public_token_expires_at', [$from, $to])
                ->limit(self::MAX_EVENTS_PER_SOURCE)->get(['id', 'subject_name', 'public_token_expires_at']);
            foreach ($links as $lead) {
                $events->push($event('lead_form_expiry', 'web', (string) $lead->id, Carbon::parse($lead->public_token_expires_at), $lead->subject_name, '/admin/web/sales-leads', 'warning'));
            }
        }

        if ($this->can('core-administrators-view')) {
            $tokens = AccountActivationToken::whereBetween('expires_at', [$from, $to])
                ->limit(self::MAX_EVENTS_PER_SOURCE)->get(['id', 'user_id', 'expires_at']);
            $users = User::whereIn('id', $tokens->pluck('user_id'))->whereNull('activated_at')->pluck('user_email', 'id');
            foreach ($tokens as $token) {
                if (isset($users[$token->user_id])) {
                    $events->push($event('activation_expiry', 'core', (string) $token->id, $token->expires_at, (string) $users[$token->user_id], '/admin/core/administrators', 'warning'));
                }
            }
        }

        return $events;
    }

    /**
     * @description Open work of the user's modules (only sources with at least one item).
     * @return array<int, array{type: string, module: string, count: int, since: string|null, link: string}>
     */
    private function reminders(): array
    {
        $reminders = [];
        // since = the oldest item (created_at); null for a state without a start (low stock).
        $add = function (string $type, string $module, string $link, $query, ?string $dateColumn = 'created_at') use (&$reminders) {
            $count = (clone $query)->count();
            if ($count > 0) {
                $oldest = $dateColumn ? (clone $query)->min($dateColumn) : null;
                $reminders[] = [
                    'type' => $type, 'module' => $module, 'count' => $count, 'link' => $link,
                    'since' => $oldest ? Carbon::parse($oldest)->toDateString() : null,
                ];
            }
        };

        if ($this->can('web-job-applications-view')) {
            $add('job_applications_new', 'web', '/admin/web/job-applications', WebJobApplication::where('state', 'new'));
        }
        if ($this->can('web-support-tickets-view')) {
            $add('support_tickets_open', 'web', '/admin/web/support-tickets', WebSupportTicket::whereIn('state', ['new', 'open']));
        }
        if ($this->can('web-user-requests-view')) {
            $add('inquiries_new', 'web', '/admin/web/user-request', WebRawRequestCommission::where('status', 'new'));
        }
        if ($this->can('web-sales-orders-view')) {
            $add('web_orders_without_project', 'web', '/admin/web/sales-orders',
                WebSalesOrder::whereNotIn('id', WebProject::withTrashed()->whereNotNull('order_id')->select('order_id')));
        }
        if ($this->can('web-sales-leads-view')) {
            $limit = now()->subDays(self::LEAD_FOLLOW_UP_DAYS)->toDateString();
            $add('leads_without_contact', 'web', '/admin/web/sales-leads', WebSalesLead::whereNotIn('status', self::LEAD_CLOSED_STATES)
                ->where(fn ($q) => $q->where('last_contact_date', '<', $limit)
                    ->orWhere(fn ($q) => $q->whereNull('last_contact_date')->where('created_at', '<', now()->subDays(self::LEAD_FOLLOW_UP_DAYS)))));
        }
        if ($this->can('shop-orders-view')) {
            $add('shop_orders_open', 'shop', '/admin/shop/orders', ShopOrder::whereIn('status', self::SHOP_ORDER_OPEN_STATES));
        }
        if ($this->can('shop-products-view')) {
            $add('products_low_stock', 'shop', '/admin/shop/products', ShopProduct::where('is_active', true)
                ->whereColumn('stock_quantity', '<=', 'stock_warning_level'), null);
        }
        if ($this->can('core-security-view')) {
            $add('security_events_new', 'core', '/admin/core/security-events', CoreSecurityEvent::where('status', 'new'));
        }

        return $reminders;
    }
}
