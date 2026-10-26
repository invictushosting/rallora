/** Keep account errors actionable without claiming whether an email is registered. */
export function inviteAuthError(issue:{code?:string;message?:string},mode:"create"|"signin"):string{
 const message=issue.message??"";
 if(issue.code==="invalid_credentials"||/invalid login credentials/i.test(message))return "Email or password is incorrect. New to Rallora? Choose Create account first. If you already have an account, use Forgot password to reset your Rallora password.";
 if(issue.code==="email_not_confirmed"||/email not confirmed/i.test(message))return "Confirm your Rallora email before signing in. Check your inbox and junk folder, or resend the confirmation email below. Then return to this invitation.";
 if(issue.code==="user_already_exists"||/already registered|already been registered/i.test(message))return "You may already have a Rallora account. Choose Sign in or use Forgot password. Your team invitation is still available.";
 if(issue.code==="over_email_send_rate_limit"||issue.code==="over_request_rate_limit")return "Please wait a moment before trying again. Your team invitation is still available.";
 return message||(mode==="create"?"We could not create your account. Please try again.":"We could not sign you in. Please try again.");
}
