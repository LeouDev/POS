import { BUSINESS, HOW_TO_VIDEO_ID, HOW_TO_VIDEO_URL, USER_GUIDE_PATH } from "@/lib/business";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PLANS, TRIAL_DAYS } from "@/lib/trial";

export type Welcome = {
  businessName: string;
  ownerName: string;
  trialEndsAt: string;
  timezone: string;
  /** Where the owner signed up, e.g. https://kassix-pos.vercel.app; links point back there. */
  origin: string;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FONT = "font-family:Tahoma,Verdana,Arial,sans-serif;";
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#c0c0c0;border:2px solid;border-color:#ffffff #000000 #000000 #ffffff;padding:8px 18px;">` +
  `<a href="${href}" style="${FONT}font-size:15px;font-weight:bold;color:#000000;text-decoration:none;">${label}</a></td></tr></table>`;

/** The welcome email for a new business: the how-to video, the user guide and when the trial ends. */
export function welcomeEmail({ businessName, ownerName, trialEndsAt, timezone, origin }: Welcome) {
  const endDate = formatDateTime(trialEndsAt, timezone, "date");
  const guideUrl = origin + USER_GUIDE_PATH;
  const appUrl = `${origin}/dashboard`;
  const [guideHref, appHref] = [esc(guideUrl), esc(appUrl)];
  const price = `₱${formatNumber(PLANS.monthly.amount)} a month or ₱${formatNumber(PLANS.yearly.amount)} a year`;
  const subject = `Welcome to KASSIX, ${businessName}!`;

  const text = [
    ownerName ? `Hi ${ownerName},` : "Hi there,",
    "",
    `Welcome to KASSIX! ${businessName}'s free trial has started: every feature is free for ${TRIAL_DAYS} days, until ${endDate}.`,
    "",
    "Three steps to get going:",
    `1. Watch how to use KASSIX: ${HOW_TO_VIDEO_URL}`,
    `2. Keep the user guide handy: ${guideUrl}`,
    `3. Open KASSIX, set up your shop in Settings, and add your products: ${appUrl}`,
    "",
    `After your trial, KASSIX Pro is ${price}. Nothing renews automatically.`,
    "",
    "Questions? Just reply to this email.",
    "",
    "Happy selling!",
    "The KASSIX team",
    "",
    "--",
    `KASSIX is operated by ${BUSINESS.name}, ${BUSINESS.address}.`,
    "You're getting this email because you created a KASSIX account.",
  ].join("\n");

  const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to KASSIX</title></head>
<body style="margin:0;padding:0;background:#008080;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#008080;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#c0c0c0;border:2px solid;border-color:#dfdfdf #000000 #000000 #dfdfdf;">
<tr><td style="background:#000080;background-image:linear-gradient(90deg,#000080,#1084d0);padding:6px 10px;${FONT}font-size:14px;font-weight:bold;color:#ffffff;">Welcome to KASSIX</td></tr>
<tr><td style="padding:20px;${FONT}font-size:15px;line-height:1.5;color:#000000;">
${p(ownerName ? `Hi ${esc(ownerName)},` : "Hi there,")}
${p(`Welcome to KASSIX! <b>${esc(businessName)}</b>&rsquo;s free trial has started: every feature is free for ${TRIAL_DAYS} days, until <b>${endDate}</b>.`)}
${p("Three steps to get going:")}
${p(`<b>1. Watch how to use KASSIX</b>`)}
<a href="${HOW_TO_VIDEO_URL}" style="display:block;margin:0 0 6px;border:2px solid;border-color:#808080 #ffffff #ffffff #808080;"><img src="https://i.ytimg.com/vi/${HOW_TO_VIDEO_ID}/maxresdefault.jpg" width="512" alt="Play: How to use KASSIX" style="display:block;width:100%;height:auto;border:0;"></a>
${p(`<a href="${HOW_TO_VIDEO_URL}" style="color:#000080;">&#9654; Play the video on YouTube</a>`)}
${p(`<b>2. Keep the user guide handy.</b> Every screen, step by step: <a href="${guideHref}" style="color:#000080;">open the KASSIX user guide</a>.`)}
${p("<b>3. Set up your shop.</b> Open KASSIX, check your business name, currency and tax in Settings, then add your products.")}
${button(appHref, "Open KASSIX")}
<p style="margin:18px 0 14px;">After your trial, KASSIX Pro is ${price}. Nothing renews automatically: you only pay when you choose to.</p>
${p("Questions? Just reply to this email.")}
<p style="margin:0;">Happy selling!<br>The KASSIX team</p>
</td></tr></table>
<p style="max-width:560px;margin:14px auto 0;${FONT}font-size:12px;line-height:1.5;color:#ffffff;">KASSIX is operated by ${esc(BUSINESS.name)}, ${esc(BUSINESS.address)}.<br>You&rsquo;re getting this email because you created a KASSIX account.</p>
</td></tr></table>
</body></html>`;

  return { subject, html, text };
}

/** Sends the welcome email through Brevo. Never throws: a failed email must not break signing up. */
export async function sendWelcomeEmail(to: string, welcome: Welcome) {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.warn("[email] BREVO_API_KEY or EMAIL_FROM isn't set; welcome email skipped for", to);
    return;
  }
  const { subject, html, text } = welcomeEmail(welcome);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "KASSIX", email: from },
        to: [{ email: to, name: welcome.ownerName || welcome.businessName }],
        replyTo: { email: BUSINESS.email, name: "KASSIX support" },
        subject,
        htmlContent: html,
        textContent: text,
        tags: ["welcome"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("[email] Brevo rejected the welcome email", res.status, await res.text());
  } catch (err) {
    console.error("[email] welcome email failed", err);
  }
}
