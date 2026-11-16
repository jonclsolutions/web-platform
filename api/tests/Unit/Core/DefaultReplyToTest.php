<?php

/**
 * @file DefaultReplyToTest.php
 * @path api/tests/Unit/Core/DefaultReplyToTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the default Reply-To of the sent e-mails (DefaultReplyTo,
 *   config mail.default_reply_to = env MAIL_REPLY_TO_ADDRESS).
 * @dependencies
 * - Tests\TestCase; the `array` mailer of phpunit.xml (keeps the sent messages).
 */

namespace Tests\Unit\Core;

use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Address;
use Tests\TestCase;

/**
 * @description App\Support\Mail\DefaultReplyTo.
 */
class DefaultReplyToTest extends TestCase
{
    /**
     * @description Sends one plain e-mail through the array mailer and returns its Reply-To.
     * @param callable|null $build Extra changes of the message (e.g. its own Reply-To).
     * @return list<string> Reply-To addresses of the sent e-mail.
     */
    private function sendAndReadReplyTo(?callable $build = null): array
    {
        $transport = Mail::mailer('array')->getSymfonyTransport();
        $transport->flush();
        Mail::mailer('array')->raw('Body', function (Message $message) use ($build) {
            $message->to('customer@example.com')->subject('Test');
            if ($build) {
                $build($message);
            }
        });

        $sent = $transport->messages()->last()->getOriginalMessage();

        return array_map(fn (Address $a) => $a->getAddress(), $sent->getReplyTo());
    }

    /**
     * @description An e-mail without its own Reply-To gets the configured address.
     * @input mail.default_reply_to.address = info@acme.cz; plain e-mail.
     * @output Reply-To [info@acme.cz].
     */
    public function test_default_reply_to_is_added(): void
    {
        config(['mail.default_reply_to.address' => 'info@acme.cz', 'mail.default_reply_to.name' => 'Acme']);

        $this->assertSame(['info@acme.cz'], $this->sendAndReadReplyTo());
    }

    /**
     * @description An e-mail with its own Reply-To keeps only that one.
     * @input Configured info@acme.cz; message with Reply-To sales@acme.cz.
     * @output Reply-To [sales@acme.cz].
     */
    public function test_own_reply_to_is_kept(): void
    {
        config(['mail.default_reply_to.address' => 'info@acme.cz']);

        $this->assertSame(['sales@acme.cz'], $this->sendAndReadReplyTo(fn (Message $m) => $m->replyTo('sales@acme.cz')));
    }

    /**
     * @description Nothing configured, or an invalid address: no Reply-To, the e-mail is sent.
     * @input address null; then 'not-an-address'.
     * @output Reply-To [] both times.
     */
    public function test_empty_or_invalid_address_adds_nothing(): void
    {
        config(['mail.default_reply_to.address' => null]);
        $this->assertSame([], $this->sendAndReadReplyTo());

        config(['mail.default_reply_to.address' => 'not-an-address']);
        $this->assertSame([], $this->sendAndReadReplyTo());
    }
}
