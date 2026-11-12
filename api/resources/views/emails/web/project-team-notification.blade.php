{{--
    @file project-team-notification.blade.php
    @path resources/views/emails/web/project-team-notification.blade.php
    @project JS web-platform
    @author JS
    @created 2026
    @description Internal notification of an administrator (ProjectTeamNotificationMail): a thread
    assigned to them / a client decision on an approval - the title and a link to the project in
    the administration, never a message text or comment.
--}}
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
              <p style="margin: 0 0 12px; font-size: 0.95rem; color: #18181b;">{{ $intro }}</p>
              <p style="margin: 0 0 20px; padding: 10px 14px; background: #fafafa; border: 1px solid #ececea; border-radius: 10px; font-size: 0.9rem; font-weight: 600; color: #18181b;">{{ $itemTitle }}</p>
              <a href="{{ $adminUrl }}" style="display: inline-block; padding: 10px 20px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 999px; font-size: 0.85rem; font-weight: 600;">Open in the administration</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
