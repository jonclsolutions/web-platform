<!--
    @file: project-thread-activity.blade.php
    @path: resources/views/emails/web/project-thread-activity.blade.php
    @project: RPSW Web
    @author: RPSW
    @created: 2026
    @description Internal notification (ProjectThreadActivityMail) to the project's contact
    e-mail about customer activity in a project thread - only the thread subject and a link to
    the administration, never the message text.
    @bugfix-note (2026-10-23) The texts were hardcoded in Czech (and `lang="cs"`) while the
    subject of the same mail is English (open finding #10) - now English like the subject.
-->
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f3; padding: 24px; margin: 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 16px; border: 1px solid #ececea; overflow: hidden;">
          <tr>
            <td style="background: #18181b; padding: 20px 28px;">
              <span style="color: #ffffff; font-size: 1.05rem; font-weight: 700;">{{ $projectName }}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 26px 28px;">
              <p style="margin: 0 0 12px; font-size: 0.95rem; color: #18181b;">
                {{ $isNewThread ? 'The customer started a new thread:' : 'The customer wrote a new message in the thread:' }}
              </p>
              <p style="margin: 0 0 20px; padding: 10px 14px; background: #fafafa; border: 1px solid #ececea; border-radius: 10px; font-size: 0.9rem; font-weight: 600; color: #18181b;">
                {{ $threadSubject }}
              </p>
              <a href="{{ $adminUrl }}" style="display: inline-block; padding: 10px 20px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 999px; font-size: 0.85rem; font-weight: 600;">
                Open in the administration
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>