<?php

/**
 * @file DefaultReplyTo.php
 * @path app/Support/Mail/DefaultReplyTo.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Listener of MessageSending: an e-mail of the application without its own
 * Reply-To gets the default one (`mail.default_reply_to`, env MAIL_REPLY_TO_ADDRESS - `info@` of
 * the domain), so a customer answering an e-mail sent from `noreply@` reaches a read mailbox.
 * An e-mail that sets its own Reply-To keeps it (never two addresses).
 * @dependencies
 * - Illuminate\Mail\Events\MessageSending: fired before every sent e-mail (registered in
 *   AppServiceProvider::boot()).
 */

namespace App\Support\Mail;

use Illuminate\Mail\Events\MessageSending;
use Symfony\Component\Mime\Address;

class DefaultReplyTo
{
    /**
     * @description Adds the default Reply-To to an e-mail that has none. An empty or invalid
     * configured address adds nothing (sending never fails because of it).
     * @param MessageSending $event The e-mail about to be sent.
     * @return void
     */
    public function handle(MessageSending $event): void
    {
        $address = trim((string) config('mail.default_reply_to.address'));
        if ($address === '' || ! filter_var($address, FILTER_VALIDATE_EMAIL)) {
            return;
        }
        if ($event->message->getReplyTo() !== []) {
            return;
        }

        $event->message->replyTo(new Address($address, (string) config('mail.default_reply_to.name', '')));
    }
}
