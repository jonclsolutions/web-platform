{{--
    @file footer.blade.php
    @path resources/views/emails/partials/footer.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Shared footer of EVERY transactional e-mail - company name + contact e-mail /
    phone. The variables ($companyName, $contactEmail, $contactPhone) come from
    App\Support\Mail\CompanyContactInfo::get() through Content::with() of the Mailable; @include
    shares the variables of the parent view.
    @note A missing $contactEmail / $contactPhone does not break the footer - the contact line is
    left out, only the company name stays.
--}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
    <tr>
        <td style="padding-top:20px;border-top:1px solid #e4e4e7;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#3f3f46;">
                {{ $companyName ?? config('app.name') }}
            </p>
            @if (!empty($contactEmail) || !empty($contactPhone))
                <p style="margin:0;font-size:12px;color:#71717a;">
                    @if (!empty($contactEmail))
                        <a href="mailto:{{ $contactEmail }}" style="color:#2563eb;text-decoration:none;">{{ $contactEmail }}</a>
                    @endif
                    @if (!empty($contactEmail) && !empty($contactPhone))
                        <span style="margin:0 6px;color:#d4d4d8;">&middot;</span>
                    @endif
                    @if (!empty($contactPhone))
                        <span>{{ $contactPhone }}</span>
                    @endif
                </p>
            @endif
        </td>
    </tr>
</table>