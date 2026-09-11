<?php
/**
 * @file StoreWebSalesLeadRequest.php
 * @path app/Http/Requests/Web/WebSalesLead/StoreWebSalesLeadRequest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Validation logic for creating new sales leads from web sources.
 */

namespace App\Http\Requests\Web\WebSalesLead;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @description Handles request validation for new sales lead acquisition, ensuring data integrity across various CRM channels.
 */
class StoreWebSalesLeadRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize(): bool { return true; }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules(): array
    {
        return [
            'subject_name'       => ['required', 'string', 'min:2', 'max:255'],
            'first_contact_date' => ['nullable', 'date'],
            'source_channel'     => ['required', 'string', 'max:255', 'in:' . implode(',', [
                'linkedin_dm', 'linkedin_post', 'facebook_group', 'facebook_dm', 'instagram_dm',
                'x_twitter', 'whatsapp', 'telegram', 'web_form', 'email_cold', 'email_newsletter',
                'phone_cold_call', 'phone_inbound', 'in_person_meeting', 'networking_event',
                'referral', 'former_client', 'inquiry_portal', 'google_business', 'paid_ads_ppc',
                'partner_affiliate', 'other_online', 'other_offline',
            ])],
            'user_id'            => ['nullable', 'integer', 'exists:users,id'],
            'salesman_name'      => ['nullable', 'string', 'max:255'],
            'contact_person'     => ['nullable', 'string', 'max:255'],
            'contact_email'      => ['nullable', 'email', 'max:255'],
            'contact_phone'      => ['nullable', 'string', 'regex:/^(\+?[0-9]{1,3})?[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}$/'],
            'contact_other'      => ['nullable', 'string', 'max:255'],
            'location'           => ['nullable', 'string', 'max:100'],
            'source_url'         => ['nullable', 'url', 'max:500'],
            'description'        => ['nullable', 'string'],
            'priority'           => ['required', 'string', 'max:255', 'in:low,below_average,neutral,high,critical'],
            'status'             => ['required', 'string', 'max:255', 'in:' . implode(',', [
                'new', 'in_communication', 'preparing_offer', 'offer_sent', 'inquiry_form_sent',
                'negotiating', 'on_hold', 'handed_to_dev_team', 'closed_won', 'awaiting_invoicing',
                'awaiting_payment', 'paid_project_started', 'closed_lost', 'other',
            ])],
            'last_contact_date'  => ['nullable', 'date'],
            'next_step'          => ['nullable', 'string', 'max:255'],
            'rejection_reason'   => ['nullable', 'string'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'subject_name.required'     => 'The subject or company name is required.',
            'subject_name.min'          => 'The subject name must be at least 2 characters.',
            'source_channel.required'   => 'Please select a source channel.',
            'source_channel.in'         => 'The selected source channel is invalid.',
            'contact_email.email'       => 'Please provide a valid email address.',
            'contact_phone.regex'       => 'Please provide a valid phone number.',
            'source_url.url'            => 'Please provide a valid URL address.',
            'priority.required'         => 'Please select the lead priority.',
            'priority.in'               => 'The selected priority is invalid.',
            'status.required'           => 'Please select the current lead status.',
            'status.in'                 => 'The selected status is invalid.',
        ];
    }
}