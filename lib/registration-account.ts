/** Validate credentials before a signed-out player can submit a saved draft. */
export function registrationAccountIssue(email: string, password: string, mode: "create" | "signin"): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please enter your email and password to finish your saved registration. Your player and partner details are still saved.";
  }
  if (!password || (mode === "create" && password.length < 8)) {
    return mode === "signin"
      ? "Please enter your password to sign in and finish your saved registration."
      : "Please enter a password of at least 8 characters to finish creating your account. Your registration details are still saved.";
  }
  return null;
}
