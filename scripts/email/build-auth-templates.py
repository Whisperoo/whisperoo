"""
Generate the branded Supabase Auth email templates (supabase/templates/*.html).

Supabase sends account emails (confirm signup, reset password, …) itself, using
Go template variables such as {{ .ConfirmationURL }}. These files are the bodies
to paste into Dashboard → Authentication → Email Templates (one per type), with
the subject lines printed at the end of this script. config.toml points at the
same files so local Supabase uses them too.

Re-run after editing copy or layout:   python scripts/email/build-auth-templates.py

Design: table-based layout with inline styles — what Gmail, Outlook and Apple Mail
render consistently. Logo is the public wordmark served by the production app.
No links other than the action button and the plain fallback URL beneath it.
"""
from pathlib import Path

LOGO = "https://app.whisperoo.app/lovable-uploads/96238edd-91f3-4ff1-87be-ac5d867fa98a.png"
BLUE = "#2E54A5"       # action blue (tailwind indigo-600 in the app)
INK = "#1A202C"
TEXT = "#4A5568"
MUTED = "#718096"
LINE = "#E2E8F0"
BG = "#F5F7FB"
FONT = "Helvetica, Arial, sans-serif"

OUT = Path(__file__).resolve().parents[2] / "supabase" / "templates"


def layout(title: str, heading: str, body_html: str, action: str | None = None,
           action_url: str | None = None, after_html: str = "") -> str:
    button = ""
    if action and action_url:
        button = f"""
          <tr>
            <td style="padding:8px 32px 8px 32px;">
              <a href="{action_url}" style="display:inline-block;background:{BLUE};color:#ffffff;text-decoration:none;font-family:{FONT};font-size:15px;font-weight:600;line-height:20px;padding:14px 28px;border-radius:10px;">{action}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0 32px;font-family:{FONT};font-size:12px;line-height:18px;color:{MUTED};">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="{action_url}" style="color:{BLUE};word-break:break-all;">{action_url}</a>
            </td>
          </tr>"""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:{BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid {LINE};border-radius:16px;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <img src="{LOGO}" width="140" height="48" alt="Whisperoo" style="display:block;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 4px 32px;font-family:{FONT};">
              <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;color:{INK};">{heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 16px 32px;font-family:{FONT};font-size:15px;line-height:24px;color:{TEXT};">
              {body_html}
            </td>
          </tr>{button}
          <tr>
            <td style="padding:20px 32px 0 32px;font-family:{FONT};font-size:14px;line-height:22px;color:{TEXT};">
              {after_html}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid {LINE};padding-top:16px;font-family:{FONT};font-size:12px;line-height:18px;color:{MUTED};">
                    Questions? Email us at <a href="mailto:support@whisperoo.app" style="color:{BLUE};">support@whisperoo.app</a>.<br>
                    You're receiving this email because of activity on your Whisperoo account.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


IGNORE = "If you didn't request this, you can safely ignore this email."

TEMPLATES = {
    # file name: (dashboard template name, subject, html)
    "confirmation.html": ("Confirm signup", "Confirm your email for Whisperoo", layout(
        "Confirm your email", "Confirm your email",
        "Welcome to Whisperoo! Please confirm <strong>{{ .Email }}</strong> to finish creating your account.",
        "Confirm email", "{{ .ConfirmationURL }}",
        "If you didn't create a Whisperoo account, you can safely ignore this email.")),
    "recovery.html": ("Reset Password", "Reset your Whisperoo password", layout(
        "Reset your password", "Reset your password",
        "We received a request to reset the password for <strong>{{ .Email }}</strong>. Use the button below to choose a new one.",
        "Reset password", "{{ .ConfirmationURL }}",
        IGNORE + " Your password won't change.")),
    "magic_link.html": ("Magic Link", "Your Whisperoo sign-in link", layout(
        "Sign in to Whisperoo", "Sign in to Whisperoo",
        "Use the button below to sign in to your Whisperoo account as <strong>{{ .Email }}</strong>.",
        "Sign in", "{{ .ConfirmationURL }}", IGNORE)),
    "email_change.html": ("Change Email Address", "Confirm your new email for Whisperoo", layout(
        "Confirm your new email", "Confirm your new email",
        "Please confirm that you'd like to change your Whisperoo email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.",
        "Confirm new email", "{{ .ConfirmationURL }}",
        "If you didn't ask to change your email, please contact us at support@whisperoo.app.")),
    "invite.html": ("Invite user", "You're invited to Whisperoo", layout(
        "You're invited to Whisperoo", "You're invited to Whisperoo",
        "You've been invited to join Whisperoo. Accept the invitation to set up your account.",
        "Accept invitation", "{{ .ConfirmationURL }}",
        "If you weren't expecting this invitation, you can safely ignore this email.")),
    "reauthentication.html": ("Reauthentication", "Your Whisperoo verification code", layout(
        "Your verification code", "Your verification code",
        "Enter this code to confirm it's you:"
        f"<div style=\"margin:16px 0 4px 0;font-family:{FONT};font-size:28px;line-height:36px;font-weight:700;letter-spacing:6px;color:{INK};\">{{{{ .Token }}}}</div>",
        after_html=IGNORE)),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (_, _, html) in TEMPLATES.items():
        (OUT / name).write_text(html, encoding="utf-8", newline="\n")
    print(f"Wrote {len(TEMPLATES)} templates to {OUT}\n")
    print("Paste each into Supabase -> Authentication -> Email Templates:")
    for name, (dash, subject, _) in TEMPLATES.items():
        print(f"  {dash:<22} subject: {subject:<40} body: supabase/templates/{name}")


if __name__ == "__main__":
    main()
