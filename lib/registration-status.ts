/** Receipt copy is shown only for a registration found in the database. */
export function registrationStatus(status: string): {title: string; description: string} {
  switch (status) {
    case "approved": return {title: "Registration approved", description: "The club has approved your pairing. Visit the club page for fixtures and league tables when they are published. You do not need to submit again."};
    case "single": return {title: "Partner-finding registration received", description: "You’re on the club’s looking-for-a-partner list. The club will try to find a suitable pairing, but a match is not guaranteed. You do not need to submit again."};
    case "standby": return {title: "Standby registration received", description: "You’re on the club’s standby list. The club can contact you if a replacement is needed. You do not need to submit again."};
    case "pending": return {title: "Application received — awaiting club approval", description: "Your registration has been submitted successfully and is with the club for review. Your pairing is not yet approved for the league. You do not need to submit again."};
    case "declined":
    case "rejected": return {title: "Registration not approved", description: "The club has reviewed your entry and has not approved it. Contact the club to discuss the next step."};
    default: return {title: "Registration on record", description: "The club already has a registration for this entry. Contact the club to check its current status before submitting again."};
  }
}
