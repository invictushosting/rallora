const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAppleRelayEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1];
  return domain === 'privaterelay.appleid.com' || domain === 'private.icloud.com';
}

export function playerEmails(playtomicEmail: string, contactEmail: string, different: boolean) {
  const playtomic = playtomicEmail.trim().toLowerCase();
  const contact = different || isAppleRelayEmail(playtomic) ? contactEmail.trim().toLowerCase() : playtomic;
  const issue = !EMAIL.test(playtomic) || playtomic.length > 254
    ? 'Enter the email address shown in your Playtomic account.'
    : !EMAIL.test(contact) || contact.length > 254 || isAppleRelayEmail(contact)
      ? 'Enter an email that can receive Rallora messages. Keep your Apple relay address in the Playtomic field.'
      : null;
  return {playtomic, contact, issue};
}
