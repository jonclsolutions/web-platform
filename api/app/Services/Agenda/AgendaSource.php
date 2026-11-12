<?php
/**
 * @file AgendaSource.php
 * @path app/Services/Agenda/AgendaSource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One source of the admin calendar (CoreAgendaController): the dated events and the
 * open work of one module. The core has its own source (CoreAgendaSource); every application
 * registers its sources in its manifest (AppManifest::agendaSources()).
 * @usage Build the entries with the AgendaContext passed in - it checks the permissions of the
 *   signed-in user and gives every entry the module of the source.
 * @dependencies AgendaContext
 */

namespace App\Services\Agenda;

use Illuminate\Support\Carbon;

interface AgendaSource
{
    /**
     * @description View permissions of the admin pages this source shows entries of - the module
     *   is offered in the calendar filter when the user may see at least one of them.
     * @return array<int, string>
     */
    public function permissions(): array;

    /**
     * @description Dated events of the range the user may see.
     * @param AgendaContext $agenda Permission check and entry builder.
     * @param Carbon $from Start (inclusive).
     * @param Carbon $to End (inclusive).
     * @return array<int, array<string, mixed>> Entries built by AgendaContext::event().
     */
    public function events(AgendaContext $agenda, Carbon $from, Carbon $to): array;

    /**
     * @description Current open work the user may see (only kinds with at least one item).
     * @param AgendaContext $agenda Permission check and entry builder.
     * @return array<int, array<string, mixed>> Entries built by AgendaContext::reminder().
     */
    public function reminders(AgendaContext $agenda): array;
}
