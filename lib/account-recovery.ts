/** Show a safe recovery action for provider errors without echoing URL text. */
export function accountRecoveryNotice(search: string, hash: string): string {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const value = (key: string) => fragment.get(key) ?? query.get(key) ?? "";
  if (!value("error") && !value("error_code") && !value("error_description")) return "";
  if (value("error_code") === "otp_expired" || /expired|already.*used/i.test(value("error_description"))) {
    return "This email link has expired or already been used. If you are signed in, use Change password below. Otherwise request a new password-reset email and open the newest link.";
  }
  return "This email link could not sign you in. Request a new password-reset email or return to Sign in.";
}
