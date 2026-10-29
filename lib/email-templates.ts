// Shared, table-based layouts for email clients. Callers must escape dynamic
// values inside contentHtml; all other values are escaped by the layout.
const RALLORA_LOGO = "https://www.rallora.app/brand/rallora-email-logo-final.png";
const NAVY = "#061a39";
const escape = (value: string) => value.replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]!));

function webUrl(value?: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password ? escape(url.href) : null;
  } catch { return null; }
}

export type EmailContent = {
  preview: string;
  eyebrow: string;
  title: string;
  contentHtml: string;
  action?: { label: string; url: string };
  helpText?: string;
};
export type ClubEmailBrand = { name: string; logoUrl?: string | null; primaryColour?: string | null };

export function emailBrandColours(value?: string | null) {
  const background = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : NAVY;
  const luminance = (colour: string) => {
    const rgb = [1,3,5].map(offset => parseInt(colour.slice(offset,offset+2),16)/255)
      .map(channel => channel <= .04045 ? channel/12.92 : ((channel+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  };
  const lightContrast = 1.05/(luminance(background)+.05);
  const darkContrast = (luminance(background)+.05)/(luminance(NAVY)+.05);
  return {background,foreground:lightContrast >= darkContrast ? "#ffffff" : NAVY};
}

function render(content: EmailContent, club?: ClubEmailBrand) {
  const {background,foreground} = emailBrandColours(club?.primaryColour);
  const accent = club ? background : "#00b0fe";
  const logo = webUrl(club?.logoUrl);
  const header = club
    ? `${logo ? `<table role="presentation" align="center" cellspacing="0" cellpadding="8" style="margin:0 auto 14px;background:#ffffff;border-radius:10px"><tr><td><img src="${logo}" width="72" alt="${escape(club.name)} logo" style="display:block;width:72px;max-width:100%;height:auto;border:0"></td></tr></table>` : ""}<div style="font-size:23px;font-weight:700;letter-spacing:2px;color:${foreground}">${escape(club.name)}</div>`
    : `<img src="${RALLORA_LOGO}" width="274" alt="Rallora — Play Connect Progress" style="display:block;width:274px;max-width:100%;height:auto;margin:0 auto;border:0">`;
  const actionUrl = webUrl(content.action?.url);
  const action = actionUrl && content.action ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td align="center" bgcolor="${background}" style="border-radius:7px"><a href="${actionUrl}" style="display:block;padding:16px 20px;color:${foreground};font-size:14px;font-weight:700;text-decoration:none;border-radius:7px">${escape(content.action.label)}</a></td></tr></table>` : "";
  const help = content.helpText ?? (club ? "A question about your league? Reply to this email to contact your club." : "Need a hand? Reply to this email and the Rallora team will help.");
  const footer = club
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;background:${NAVY};border-radius:9px"><tr><td align="center" style="padding:18px"><div style="font-size:10px;letter-spacing:1.7px;color:#cad9e7;margin-bottom:9px">POWERED BY</div><a href="https://www.rallora.app" style="text-decoration:none"><img src="${RALLORA_LOGO}" width="148" alt="Rallora" style="display:block;width:148px;max-width:100%;height:auto;margin:auto;border:0"></a></td></tr></table><p style="text-align:center;font-size:11px;color:#6b8093;line-height:1.7;margin:16px 0 0">You’re receiving this email about your club’s league activity.</p>`
    : `<p style="text-align:center;font-size:11px;color:#6b8093;line-height:1.7;margin:20px 0 0"><strong style="color:${NAVY}">Your club. Your league.</strong><br>Rallora · Play. Connect. Progress.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(content.title.replaceAll("\n"," "))}</title><style>@media(max-width:440px){.email-outer{padding:16px 10px!important}.email-content{padding:26px 22px!important}.email-title{font-size:28px!important}}p{margin:0 0 15px}a{overflow-wrap:anywhere}</style></head><body style="margin:0;padding:0;background:#eaf2f8;font-family:Arial,Helvetica,sans-serif;color:${NAVY}"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(content.preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="email-outer" align="center" style="padding:32px 16px"><table role="presentation" width="540" cellspacing="0" cellpadding="0" style="width:100%;max-width:540px"><tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden"><tr><td align="center" bgcolor="${background}" style="padding:30px 25px;background:${background};border-bottom:5px solid ${accent}">${header}</td></tr><tr><td class="email-content" style="padding:32px;color:#536a80;font-size:14px;line-height:1.75"><p style="font-size:10px;font-weight:700;letter-spacing:1.8px;color:${NAVY};margin:0 0 12px">${escape(content.eyebrow)}</p><h1 class="email-title" style="font-size:31px;line-height:1.16;letter-spacing:-1px;color:${NAVY};margin:0 0 24px">${escape(content.title).replaceAll("\n","<br>")}</h1>${content.contentHtml}${action}<p style="margin:23px 0 0;font-size:13px;color:${NAVY}">See you on court,<br><strong>${club ? `The ${escape(club.name)} team` : "The Rallora team"}</strong></p></td></tr><tr><td style="padding:20px 26px;border-top:1px solid #e4edf5;background:#f8fbfe;text-align:center;font-size:12px;line-height:1.75;color:#58718a">${escape(help)}</td></tr></table>${footer}</td></tr></table></td></tr></table></body></html>`;
}

export function renderClubEmail(club: ClubEmailBrand, content: EmailContent) { return render(content,club); }
export function renderRalloraEmail(content: EmailContent) { return render(content); }

// Supabase's account emails use the platform identity. Club registration and
// league messages continue to use renderClubEmail and the club's own branding.
export const AUTH_EMAIL_DEFINITIONS = {
  confirmation: { subject: "Confirm your Rallora email", title: "Welcome to Rallora.", body: "Confirm your email address to finish setting up your Rallora account.", action: "Confirm email address" },
  invite: { subject: "You’re invited to Rallora", title: "Your place starts here.", body: "You have been invited to create a Rallora account. Follow the secure link to accept your account invitation.", action: "Accept account invitation" },
  magic_link: { subject: "Your secure Rallora sign-in link", title: "Back on court.", body: "Use the secure link below to sign in to your Rallora account.", action: "Sign in to Rallora" },
  recovery: { subject: "Reset your Rallora password", title: "A fresh start.", body: "We received a request to reset your Rallora password. Use the secure link below to choose a new one.", action: "Reset my password" },
  email_change: { subject: "Confirm your Rallora email change", title: "Confirm your email change.", body: "A change to the email address on your Rallora account has been requested. Use the secure link below to confirm this change.", action: "Confirm email change" },
  reauthentication: { subject: "Your Rallora verification code", title: "One quick security check.", body: "Enter the verification code below in Rallora to confirm it is you.", action: null },
  password_changed_notification: { subject: "Your Rallora password was changed", title: "Your password was changed.", body: "The password for your Rallora account has been changed.", action: "Review your account" },
  email_changed_notification: { subject: "Your Rallora email address was changed", title: "Your email address was changed.", body: "The email address for your Rallora account has been changed.", action: "Review your account" },
  phone_changed_notification: { subject: "Your Rallora phone number was changed", title: "Your phone number was changed.", body: "The phone number for your Rallora account has been changed.", action: "Review your account" },
  identity_linked_notification: { subject: "A sign-in method was added to your Rallora account", title: "A sign-in method was added.", body: "An additional sign-in method has been linked to your Rallora account.", action: "Review your account" },
  identity_unlinked_notification: { subject: "A sign-in method was removed from your Rallora account", title: "A sign-in method was removed.", body: "A sign-in method has been removed from your Rallora account.", action: "Review your account" },
  mfa_factor_enrolled_notification: { subject: "A verification method was added to your Rallora account", title: "A verification method was added.", body: "An additional sign-in verification method has been added to your Rallora account.", action: "Review your account" },
  mfa_factor_unenrolled_notification: { subject: "A verification method was removed from your Rallora account", title: "A verification method was removed.", body: "A sign-in verification method has been removed from your Rallora account.", action: "Review your account" },
} as const;

export type AuthEmailType = keyof typeof AUTH_EMAIL_DEFINITIONS;
const AUTH_CONFIRMATION_PLACEHOLDER = "https://rallora.invalid/auth-confirmation-link";

export function renderAuthEmail(type: AuthEmailType) {
  const definition = AUTH_EMAIL_DEFINITIONS[type];
  const notification = type.endsWith("_notification");
  const code = type === "reauthentication";
  const detail = code
    ? '<p style="padding:18px;background:#eaf2f8;border:1px solid #cbd9e7;border-radius:8px;text-align:center;font-size:30px;font-weight:700;letter-spacing:6px;color:#061a39">{{ .Token }}</p><p>This code expires shortly. Never share it with anyone.</p>'
    : notification
      ? '<p>If you did not make this change, reset your password and contact <a href="mailto:support@rallora.app">support@rallora.app</a> immediately.</p>'
      : '<p>This link expires and can only be used once. If you did not request this email, you can ignore it. Your account will not change unless you complete the action.</p>';
  const html = renderRalloraEmail({
    preview: definition.subject, eyebrow: notification ? "ACCOUNT SECURITY" : "YOUR RALLORA ACCOUNT",
    title: definition.title, contentHtml: `<p>Hi there,</p><p>${escape(definition.body)}</p>${detail}`,
    action: definition.action ? { label: definition.action, url: notification ? "https://www.rallora.app/account" : AUTH_CONFIRMATION_PLACEHOLDER } : undefined,
    helpText: "For account help, contact support@rallora.app. Never share your password or verification code.",
  }).replaceAll(AUTH_CONFIRMATION_PLACEHOLDER, "{{ .ConfirmationURL }}");
  return { subject: definition.subject, html };
}

/** A narrow Management API payload: content only, never auth/SMTP/security settings. */
export function authEmailTemplateConfig(): Record<string, string> {
  return Object.fromEntries((Object.keys(AUTH_EMAIL_DEFINITIONS) as AuthEmailType[]).flatMap(type => {
    const email = renderAuthEmail(type);
    return [[`mailer_subjects_${type}`, email.subject], [`mailer_templates_${type}_content`, email.html]];
  }));
}
