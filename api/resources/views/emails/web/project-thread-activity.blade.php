<!DOCTYPE html>
<html lang="cs">
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
                {{ $isNewThread ? 'Zákazník založil nové vlákno:' : 'Zákazník napsal novou zprávu ve vlákně:' }}
              </p>
              <p style="margin: 0 0 20px; padding: 10px 14px; background: #fafafa; border: 1px solid #ececea; border-radius: 10px; font-size: 0.9rem; font-weight: 600; color: #18181b;">
                {{ $threadSubject }}
              </p>
              <a href="{{ $adminUrl }}" style="display: inline-block; padding: 10px 20px; background: #18181b; color: #ffffff; text-decoration: none; border-radius: 999px; font-size: 0.85rem; font-weight: 600;">
                Otevřít v administraci
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>