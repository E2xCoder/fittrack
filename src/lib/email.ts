import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use onboarding@resend.dev for Resend's free shared domain (no custom domain needed)
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FitTrack — Şifre Sıfırlama</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:24px;font-weight:900;color:#22c55e;letter-spacing:-0.5px;">FitTrack</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#18181b;border:1px solid #27272a;border-radius:16px;padding:40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Icon -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <div style="width:56px;height:56px;background-color:#14532d;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:24px;line-height:56px;text-align:center;">🔐</div>
                  </td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Şifre Sıfırlama</h1>
                  </td>
                </tr>

                <!-- Body text -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="margin:0;font-size:15px;line-height:1.6;color:#a1a1aa;text-align:center;">
                      Merhaba,<br/><br/>
                      Şifrenizi sıfırlamak için aşağıdaki butona tıklayın.<br/>
                      Bu link <strong style="color:#d4d4d8;">1 saat</strong> geçerlidir.
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${resetLink}"
                       style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
                      Şifremi Sıfırla
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="border-top:1px solid #27272a;padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
                      Bu emaili siz istemediyseniz güvenle görmezden gelebilirsiniz.<br/>
                      Şifreniz değişmeyecektir.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:11px;color:#3f3f46;">
                © ${new Date().getFullYear()} FitTrack · Bu email otomatik olarak gönderilmiştir.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `FitTrack — Şifre Sıfırlama

Merhaba,

Şifrenizi sıfırlamak için aşağıdaki linke gidin. Bu link 1 saat geçerlidir.

${resetLink}

Bu emaili siz istemediyseniz güvenle görmezden gelebilirsiniz.

© ${new Date().getFullYear()} FitTrack`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "FitTrack — Şifre Sıfırlama",
    html,
    text,
  });
}
