import nodemailer from "nodemailer";
import { Order } from "@/lib/data/types";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.SMTP_FROM || "care@urbannaari.co.in";

const TEST_MODE = process.env.EMAIL_TEST_MODE === "true";
const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT;

async function sendEmail(to: string, subject: string, html: string) {
  const actualRecipient = TEST_MODE && TEST_RECIPIENT ? TEST_RECIPIENT : to;

  if (TEST_MODE) {
    console.log(`[TEST MODE] Redirected email from <${to}> to <${actualRecipient}> | Subject: ${subject}`);
  }

  await transporter.sendMail({
    from: `"Urban Naari" <${FROM_EMAIL}>`,
    to: actualRecipient,
    subject: TEST_MODE ? `[TEST] ${subject}` : subject,
    html,
  });
}

export function buildDeliveryEmailHtml(order: Order): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <style>
    :root { color-scheme: light only; }
    [data-ogsc] body, [data-ogsb] body { background-color: #F2F2F2 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F2F2F2; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F2F2F2; padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background-color: #ffffff; padding: 28px 40px; text-align: center; border-bottom: 1px solid #FFE5E6;">
            <img src="https://urbannaari.co.in/cdn/shop/files/logo_2.png?v=1772107246&width=330" alt="Urban Naari" width="180" style="display: block; margin: 0 auto; border-radius: 8px;" />
          </td>
        </tr>

        <!-- Headline -->
        <tr>
          <td style="padding: 40px 40px 16px; text-align: center;">
            <h2 style="margin: 0 0 8px; color: #1F1F1F; font-size: 24px; font-weight: 600;">Your new look has arrived!</h2>
            <p style="margin: 0; color: #999; font-size: 14px;">Order ${order.orderNumber}</p>
          </td>
        </tr>

        <!-- Warm greeting + choice validation -->
        <tr>
          <td style="padding: 8px 40px 28px;">
            <p style="color: #1F1F1F; font-size: 15px; line-height: 1.7; text-align: center;">
              Hi ${order.customerName},<br/>
              Your order just reached you — we hope you love it as much as we loved putting it together for you. Great choice!
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding: 0 40px;">
            <hr style="border: none; border-top: 1px solid #FFE5E6; margin: 0;" />
          </td>
        </tr>

        <!-- Care tip -->
        <tr>
          <td style="padding: 24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F2F2F2; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <p style="margin: 0 0 4px; color: #FF5A5F; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Style Tip</p>
                  <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">
                    To keep your outfit looking fresh, hand wash in cold water and dry in shade. Your colours will thank you.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Instagram CTA -->
        <tr>
          <td style="padding: 8px 40px 32px; text-align: center;">
            <p style="margin: 0 0 16px; color: #1F1F1F; font-size: 15px;">Love your order? We'd love to see you in it!</p>
            <a href="https://www.instagram.com/urbannaari.co.in/" style="display: inline-block; background-color: #FF5A5F; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">Share your look @urbannaari</a>
            <p style="margin: 12px 0 0; color: #aaa; font-size: 12px;">Tag us on Instagram — we feature our favourites!</p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding: 0 40px;">
            <hr style="border: none; border-top: 1px solid #FFE5E6; margin: 0;" />
          </td>
        </tr>

        <!-- Help line -->
        <tr>
          <td style="padding: 24px 40px; text-align: center;">
            <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.6;">
              Something not right? <strong>We'll fix it.</strong><br/>
              Just reply to this email or write to us at
              <a href="mailto:care@urbannaari.co.in" style="color: #FF5A5F; text-decoration: underline;">care@urbannaari.co.in</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #FF5A5F; padding: 28px 40px; text-align: center;">
            <p style="margin: 0 0 12px; color: #ffffff; font-size: 14px;">Thank you for choosing Urban Naari</p>
            <a href="https://www.instagram.com/urbannaari.co.in/" style="color: #FFE5E6; font-size: 12px; text-decoration: none;">Instagram</a>
            <span style="color: #FFE5E6; margin: 0 8px;">&#183;</span>
            <a href="https://urbannaari.co.in" style="color: #FFE5E6; font-size: 12px; text-decoration: none;">urbannaari.co.in</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDeliveryEmail(order: Order): Promise<void> {
  const subject = `Your UrbanNaari surprise just reached you!`;
  const html = buildDeliveryEmailHtml(order);
  await sendEmail(order.customerEmail, subject, html);
}
