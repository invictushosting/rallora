/** Help content is shared by the public guides and the navigation helper.
 * Review alongside changes to registration, competition setup and captain flows.
 */
export type HelpCategory = "players" | "captains" | "clubs" | "playtomic";
export type HelpSection = { id: string; title: string; steps: string[]; note?: string };
export type HelpArticle = {
  slug: string; category: HelpCategory; title: string; summary: string;
  keywords: string[]; sections: HelpSection[]; related: string[];
};
export const HELP_REVIEWED = "29 October 2026";
export const HELP_CATEGORIES: { id: HelpCategory; title: string; description: string }[] = [
  { id: "players", title: "Players", description: "Join a league, check your entry and get ready to play." },
  { id: "captains", title: "Captains", description: "Arrange matches, submit scores and review results." },
  { id: "clubs", title: "Club admins", description: "Set up competitions and manage your league day to day." },
  { id: "playtomic", title: "Playtomic", description: "Connect your club or run your league without an integration." },
];
export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "join-a-league", category: "players", title: "Join a league", summary: "Register a pair, find a partner or join the standby list.",
    keywords: ["register", "registration", "join", "pair", "single", "partner", "standby", "waiting list", "sign up", "enter", "both players", "both team members", "partner login", "two logins"],
    sections: [
      { id: "player-logins", title: "Can both team members have logins?", steps: ["Yes. Each player uses their own Rallora account, email and password.", "After the club approves the pairing, the partner can use their invitation to create an account or sign in, then press Claim team place. They do not submit another league registration.", "Both players can view fixtures, join Match chat and propose times. Captains manage results and recorded court bookings. Use Player login on the club page whenever you return. Captains can use the separate Captain login link to open the Captain centre directly."], note: "If you created an account but cannot see your team, return to your original partner invitation and claim your place using the invited email. Ask the club to check the invitation if it is missing." },
      { id: "choose", title: "Choose how to enter", steps: ["Open your club’s league centre. If several leagues are available, use Choose your league above the registration box, then press Register now for the selected competition. Entry must be open for that competition. Opening and closing dates control availability automatically. A closed league shows Registration closed and has no Register now button. An old registration link will show that league’s closed status, rather than switch you into another league. Existing partner invitations can still be claimed after registration closes.", "Choose Register a pair if you have a partner, Register as a single if you need one, or Join standby list if you can step in as a replacement.", "Check the selected competition before continuing."], note: "Single and standby entries go to the club’s player lists. They do not guarantee a pairing or a competition place." },
      { id: "details", title: "Complete your details", steps: ["Sign in to your existing Rallora account or create one. Enter the email used for your Playtomic profile where requested.", "If your Playtomic email is an Apple private relay address, supply a separate, working Rallora contact email when prompted.", "Add your player details and current rating when requested. For a pair, add your partner’s name, emails and rating too. Check spelling carefully." ] },
      { id: "team-invite", title: "Accept a partner invitation", steps: ["After club approval, open your partner invitation and choose Create your account or sign in. Use the address the invitation was sent to.", "If you are new to Rallora, choose Create account and create your own Rallora password. If you already have an account, choose Sign in. Your Playtomic password does not sign you in to Rallora.", "Complete email confirmation if requested, then return to the original invitation and sign in. Resend confirmation email is available when needed. Forgot password opens recovery in a new tab so you can return to your invitation afterwards.", "Press Claim team place to complete the invitation, then View fixtures & match chat. Use Player login on the club page for future visits. If the invitation is unavailable, check your account email with your captain or club organiser."], note: "Your captain adding your details does not create a Rallora password for you. Accepting an invitation does not require another league application." },
      { id: "submit", title: "Submit the entry", steps: ["Complete any email verification requested, then return to the registration page.", "Review the final step and press the final submit button. Creating or verifying an account alone does not enter you into the league.", "Wait for the registration receipt or current status on screen. A pairing is reviewed by the organiser before going live."], note: "If you are unsure whether your entry arrived, check the existing status before submitting again. Ask the organiser to check it if necessary." },
    ], related: ["registration-status", "emails-and-ratings", "captain-access"],
  },
  {
    slug: "view-league-fixtures", category: "players", title: "Find fixtures by division",
    summary: "Browse the public fixture list, search by division or player, and share filtered matches.",
    keywords: ["fixtures", "fixture", "division", "division 1a", "browse", "filter", "search", "match", "find", "public league", "share"],
    sections: [
      { id: "choose", title: "Choose the right league and division", steps: [
        "Open the club’s public League centre and choose the correct league from Choose league. Open Fixtures.",
        "Under Browse by division, select your division to show only its matches. Each division button displays its number of upcoming fixtures. All divisions restores the complete list.",
        "When viewing All divisions, fixtures appear under division headings rather than in one mixed list. Select Show all matches at the bottom if only the first page is shown.",
      ] },
      { id: "search", title: "Find your match quickly", steps: [
        "Use Search player, team, division or round to enter either player’s name, a team name, a division such as Division 2A, or a round.",
        "You can combine terms such as 2A Emma to narrow down matches. Search and division selection work together.",
        "Read Play by as the deadline, not a reserved court time. Check the fixture for any separately recorded booking details.",
      ] },
      { id: "share", title: "Share the right view", steps: [
        "Once you have selected your division or entered a search, choose Copy link to this view.",
        "Send that link to another player. It opens the same league, tab and filters.",
        "Use Clear filters to return to every division and all matches.",
      ] },
    ],
    related: ["captain-access", "arrange-a-match", "submit-and-confirm-results"],
  },
  {
    slug: "registration-status", category: "players", title: "Check your registration status", summary: "Understand pending, approved and duplicate entries.",
    keywords: ["pending", "approved", "declined", "duplicate", "receipt", "submitted", "confirmation", "registered", "account"],
    sections: [
      { id: "check", title: "Check that the club received your entry", steps: ["Return to the same club registration page and competition, signed in to the account you used.", "Read the current registration status or receipt. If the page says your league entry has not been submitted yet, finish the details and final submission step.", "Pending means the organiser needs to review the pairing. Approval does not mean fixtures are already published; the competition must be prepared and activated." ] },
      { id: "duplicates", title: "Fix a mistake or duplicate", steps: ["Contact the club organiser with the competition and both player names if anything is wrong.", "If both partners entered the same pair, tell the organiser which entry and captain you want to keep. Avoid making another application.", "A declined or closed duplicate entry is separate from the retained application. Ask the club to confirm the status of the entry you are keeping." ] },
    ], related: ["join-a-league", "captain-access", "emails-and-ratings"],
  },
  {
    slug: "emails-and-ratings", category: "players", title: "Rallora emails and Playtomic ratings", summary: "Use the right contact email and provide the details used for league placement.",
    keywords: ["email", "relay", "apple", "hotmail", "rating", "ratings", "profile", "password", "login", "sign in", "not receiving"],
    sections: [
      { id: "emails", title: "Know which email to use", steps: ["Your Rallora account email is the one you use to sign in and receive Rallora account messages.", "Your Playtomic email identifies your Playtomic profile. Keep the actual Playtomic email here, including an Apple relay address if that is what Playtomic uses.", "When a separate Rallora contact email is requested, use an address you can receive messages at. Enter the equivalent details for your partner."], note: "Rallora and Playtomic are separate accounts. Signing in with Playtomic credentials is not a substitute for a Rallora account." },
      { id: "ratings", title: "Enter and check ratings", steps: ["Provide your current Playtomic rating when the registration form asks for it. Repeat for your partner.", "The club may use the combined ratings for initial division placement, then make manual adjustments before activation.", "An automatic rating lookup depends on the club’s connection and available player data. If a lookup is unavailable, use the manual rating entry and ask the club about corrections. Awaiting rating means no rating has been supplied; it is not a zero rating." ] },
      { id: "missing-email", title: "If an email does not arrive", steps: ["Check spam or junk and confirm you are checking your Rallora contact inbox.", "For sign-in problems, use the password recovery option on the sign-in page.", "For a registration decision or captain permission, contact your club organiser. For a technical account problem, contact support@rallora.app with your club and a description of the issue."], note: "Never send your password or Playtomic Client Secret in a support message." },
    ], related: ["join-a-league", "playtomic-without-api", "captain-access"],
  },
  {
    slug: "captain-access", category: "captains", title: "Open your captain centre", summary: "Find your pairing, fixtures and next actions.",
    keywords: ["captain", "access", "permission", "pairing", "fixtures", "cannot see", "cant see", "not assigned", "login"],
    sections: [
      { id: "open", title: "Sign in as the assigned captain", steps: ["Open your club’s Captain centre or Captain login link and sign in with your Rallora account.", "Once the club approves your pairing and assigns you as captain, your pairing appears even while the league is being prepared. You do not need to register again.", "If you captain more than one pairing, select the correct pairing and competition. Use Search players or leagues to filter the selector by either player’s name or the league name, then choose a matching pairing. Clear search restores the full list. Super admins can use the same search in View as captain.", "Fixtures become available when the organiser activates the cycle. Use the fixture cards and next-action area to see which results need submitting or reviewing." ] },
      { id: "missing", title: "If your pairing or fixtures are missing", steps: ["Check you are using the Rallora account associated with the assigned captain, and the correct club.", "If approval has just happened, refresh the page. If no captain is assigned to your account, ask the organiser to check the pairing and captain assignment.", "If your pairing is shown with a message that the cycle is being prepared, your captain access is ready. Wait for the organiser to activate the cycle for fixtures. You do not need to submit another registration."], note: "Adding a partner’s details during registration does not give that partner captain permissions automatically." },
    ], related: ["arrange-a-match", "submit-and-confirm-results", "registration-status"],
  },
  {
    slug: "arrange-a-match", category: "players", title: "Arrange and record a match booking", summary: "Chat with the fixture’s players, agree a time, then ask a captain to record the court booking.",
    keywords: ["book", "booking", "court", "arrange", "arranged", "time", "date", "cancel", "reschedule", "4/4", "message", "chat", "proposal", "help"],
    sections: [
      { id: "conversation", title: "Message your opponents", steps: ["Open Fixtures on your club hub and choose Match chat on your fixture. Captains can also use Arrange match in the Captain centre. Sign in with the account linked to your current place in the pairing. The conversation is private to the current players of both pairings and club organisers.", "Send a message or choose Propose a time. Either player from the opposing pairing can accept or decline a proposal. Your own partner cannot accept it. A new proposal replaces the previous pending proposal.", "Unread counts appear on your fixtures. Email alerts follow the club’s communication settings and sending hours; check the match for replies if alerts are paused.", "Choose Ask organiser for help and explain what you need. The match is flagged in the club’s Match inbox."], note: "Agreeing a time does not reserve a court. Fixtures and chat can open before the league starts so players can arrange games; proposed times and recorded bookings must fall within the playing window shown in the match. If the pairing changes, propose a new time." },
      { id: "book", title: "Agree a time and book the court", steps: ["Check the fixture deadline and agree a time in the match conversation.", "Reserve the court through the club’s normal booking provider, such as Playtomic.", "If Playtomic is connected, use the correct four player profiles so the booking can be matched to the fixture. A full automatic match requires all four players."], note: "Recording a match in Rallora does not reserve or pay for a court." },
      { id: "record", title: "Record an agreed booking manually", steps: ["Open Arrange match from the fixture and find Agreed court booking under Match arrangements. An accepted proposal pre-fills the booking form.", "A captain or organiser can choose Record agreed booking. Enter the start time in your device’s local time, choose the duration and optionally add the court.", "Press Save agreed booking. Both captains can see the recorded arrangement, and it informs reminders." ] },
      { id: "change", title: "Change or cancel the arrangement", steps: ["Make any change or cancellation with the booking provider first and agree it with your opponents.", "Use Update recorded booking or Remove recorded booking in Rallora so the fixture information stays correct.", "If an automatic Playtomic match looks wrong or stays pending, ask the organiser to review it."], note: "Removing a recorded booking in Rallora does not cancel the actual court reservation." },
    ], related: ["submit-and-confirm-results", "playtomic-booking-matching", "playtomic-without-api"],
  },
  {
    slug: "submit-and-confirm-results", category: "captains", title: "Submit, confirm or dispute a result", summary: "Turn the match score into an official result and updated standings.",
    keywords: ["result", "score", "scores", "confirm", "confirmation", "dispute", "disputed", "winner", "standings", "table", "points"],
    sections: [
      { id: "submit", title: "Submit the score", steps: ["After the match, open the correct fixture in the Captain centre.", "Enter both pairings’ scores in the format shown, select the winning pairing and check the player names.", "Submit and confirm the prompt. The opposing captain is then asked to check the result."], note: "Scores are submitted in Rallora. The Playtomic connection does not import official league results." },
      { id: "review", title: "Confirm or dispute", steps: ["The opposing captain opens the result awaiting review and checks the submitted score.", "Confirm it if correct. The result becomes official and the league standings update.", "If it is wrong, choose the dispute action and add a clear note explaining the issue. The club organiser reviews it." ] },
      { id: "status", title: "Understand the result status", steps: ["Awaiting confirmation means the opposing captain still needs to review the submitted result.", "With organiser or Disputed result means the club needs to resolve it. Do not create another fixture or submit a duplicate entry.", "If an official result needs correcting, contact the organiser so they can review the score and use the official-result tools." ] },
    ], related: ["captain-access", "club-results", "arrange-a-match"],
  },
  {
    slug: "club-getting-started", category: "clubs", title: "Get your club ready", summary: "Set up branding, staff and your first competition.",
    keywords: ["setup", "start", "onboard", "club admin", "branding", "logo", "staff", "sponsor", "dashboard"],
    sections: [
      { id: "access", title: "Open club administration", steps: ["Sign in with the organiser account granted access to your club. If access is missing, contact Rallora support.", "Use Club profile & branding in the setup checklist to add the approved club logo, cover, contact details and welcome text.", "Check player registration settings and terms. Use Club staff to manage the people who should administer the club." ] },
      { id: "prepare", title: "Prepare the player experience", steps: ["Create your first competition as a private draft and work through its readiness steps.", "Set Notifications & reminders to the channels, timings and sending hours your club wants.", "Add any club or league sponsors in Sponsors, check the public hub and preview the competition before activating it." ] },
      { id: "optional", title: "Choose whether to connect Playtomic", steps: ["Your club can run registrations, fixtures and results without an API connection.", "To use supported booking matching and player lookups, follow the Playtomic setup guide and verify the connection under Integrations.", "Share the player and captain guides with your league entrants." ] },
    ], related: ["create-and-launch-competition", "club-reminders", "connect-playtomic"],
  },
  {
    slug: "create-and-launch-competition", category: "clubs", title: "Create and launch a competition", summary: "From a private draft to open entry, divisions, fixtures and activation.",
    keywords: ["create", "competition", "season", "league", "launch", "activate", "draft", "visible", "publish", "registration window", "format", "box"],
    sections: [
      { id: "draft", title: "Create the private draft", steps: ["From club admin, use Create your first competition or open the league builder in Seasons & Divisions.", "In Competition basics, enter the competition start and overall finish date. For rolling boxes, choose one month per round or set each round’s dates yourself. Check the playing schedule preview, then set registration dates, division sizes, scoring and promotion/relegation rules.", "Review the final step and create the private draft. Check every setting against the club’s published league rules." ] },
      { id: "entry", title: "Open and review registration", steps: ["Use Open registration on the competition readiness card. Check the registration dates too; publishing entry and being within its window are both needed for players to enter.", "Review pairing applications in Registrations. Check both player names, contact details, ratings and duplicate warnings before approving.", "When entry is complete, close registration before building the divisions. Publishing registration makes entry available without publishing a finished fixture list." ] },
      { id: "divisions", title: "Place teams and prepare fixtures", steps: ["Build the competition divisions from reviewed registrations. Use combined Playtomic ratings for initial placement if that is the club’s chosen method.", "Review the draft placements and manually move or swap teams where needed before activation. Placement changes can clear untouched draft fixtures; generate fixtures again after your final adjustments.", "Open Fixtures & playing rounds. The first round’s dates are filled from your saved schedule. Generate fixtures, then use Preview competition to check the player-facing competition." ] },
      { id: "activate", title: "Activate when ready", steps: ["Check that entry is closed, each division has at least two teams and every team has fixtures.", "Confirm deadlines, scores, captain assignments and the public preview.", "Choose Activate. An active competition enables the match and result flow for players. If activation is blocked, complete the missing readiness requirements shown."], note: "Opening registration and activating a competition are separate steps. Always check the public club hub after each publication change." },
      { id: "next-round", title: "Move into the next playing round", steps: ["When the current round ends, check all results and resolve outstanding or disputed scores. Complete every fixture if your competition requires it.", "Open Fixtures & playing rounds and select the current competition round. The saved plan supplies the next start date and deadline. Choose Prepare next round to apply promotion/relegation and create the next fixtures as a private draft.", "Review the new boxes and fixtures, then activate the new round. Captains keep their pairing access. After the final planned round, review results and complete the competition."], note: "A saved monthly schedule does not automatically promote pairs or publish the next round. The organiser prepares, reviews and activates each one." },
    ], related: ["manage-teams-and-entries", "club-reminders", "club-results"],
  },
  {
    slug: "add-late-team", category: "clubs", title: "Add a team after registration closes",
    summary: "Use the club admin deadline override to add a missed pair to a draft or active competition.",
    keywords: ["late", "missed deadline", "registration closed", "after deadline", "add team", "add players", "late entry", "late registration", "existing team", "create team", "override"],
    sections: [
      { id: "open", title: "Open the late registration tool", steps: [
        "Sign in as a club owner, admin or organiser. Open the relevant club’s Admin Dashboard, then Registrations.",
        "Choose Add a team after registration closes. Pick the correct league and division. The tool accepts the current draft or active competition; it is not for completed competitions.",
        "Check that you are entering a full two-player pairing. For a player joining an existing pairing as a replacement, use Teams & players → Add from Standby instead."
      ], note: "Only club staff with permission can override the deadline. Ordinary players cannot reopen a closed public registration form." },
      { id: "existing", title: "Add a pairing already registered at your club", steps: [
        "Choose Existing team and select a pairing from another league at the same club. The existing team must have a registered captain and a partner email.",
        "Enter a reason for the exception, such as a confirmed late request, and choose Confirm late registration.",
        "Rallora creates a separate entry for the chosen competition. The original team and its previous competition results are preserved."
      ], note: "Existing team means a pairing from another competition at the same club, not an existing team already in the selected league." },
      { id: "new", title: "Create a new pairing after the deadline", steps: [
        "The captain must have a Rallora account already. If necessary, ask them to use rallora.app/signup first, then verify their account email and sign in.",
        "Choose Create new team. Enter the captain name and Rallora account email, plus the partner’s name and email. The team name is optional and defaults to the player names. Supply both ratings when requested. Use different email addresses for the two players.",
        "Enter the reason for the deadline override and press Confirm late registration. Share the resulting partner invitation link with the partner; they must claim their place using the invited email."
      ], note: "This is a two-player pairing registration. Entering someone’s email does not create their password or automatically claim the partner’s place." },
      { id: "fixtures", title: "If fixtures have already been generated", steps: [
        "Read the confirmation carefully. If fixtures already exist, Rallora warns that the division schedule needs review.",
        "The late-entry tool does not regenerate fixtures, create the new team’s missing matches, or delete existing results. Review Fixtures & playing rounds and organise the outstanding games through the club’s normal fixture workflow.",
        "Check both players’ team access and the revised fixture plan before notifying other captains. Keep already played results intact."
      ], note: "The late-entry confirmation is not proof that the new pairing has fixtures. An organiser must check and arrange them." },
      { id: "problems", title: "If the team cannot be added", steps: [
        "Check you selected the right club, league and division, and that the league is draft or active.",
        "For a new team, confirm the captain has a Rallora account. For an existing team, check the source captain membership and partner email. Duplicate pairings or players already in the target competition may be rejected.",
        "If the team consists of one replacement player rather than a new pair, use the replacement workflow instead. If an error persists, send support the club, league and error message without passwords."
      ] }
    ], related: ["manage-teams-and-entries", "join-a-league", "create-and-launch-competition", "captain-access"],
  },
  {
    slug: "manage-teams-and-entries", category: "clubs", title: "Manage entries, divisions and players", summary: "Review entries, adjust draft placement, swap players and manage standby places.",
    keywords: ["teams", "players", "move", "division", "placement", "replace", "replacement", "swap", "exchange", "drop out", "standby", "duplicate", "approve", "decline"],
    sections: [
      { id: "entries", title: "Review applications", steps: ["Open Registrations from club admin. Check the League name shown on each entry card, then review that pairing’s player names, emails and ratings. Singles and standby cards show their league too.", "Check duplicate warnings before approving. If the same pair was entered twice, establish which entry to retain and use the duplicate action to close the extra entry.", "Use a decline decision for an entry that should not proceed, and check that the intended pairing remains approved or pending as appropriate." ] },
      { id: "ratings", title: "Correct league ratings", steps: ["Open Registrations and find the correct league and pairing. Choose Edit ratings on a pending or approved entry.", "Enter both confirmed player ratings and save. Approved pairings and unclaimed partner invitations update together; division placements and fixtures stay in place.", "Awaiting rating means the value has not been supplied. Obtain it from the player or club before editing; do not use zero as a placeholder."], note: "These are Rallora league entry ratings. Editing them does not change a player’s external Playtomic profile." },
      { id: "placement", title: "Adjust draft division placement", steps: ["Open the draft competition’s placement controls after registrations are reviewed.", "Use Starting boxes & manual adjustments to review the rating-based arrangement. Choose the Pairing to move and Destination box. If that box is full, select a pairing to swap with, then use Move pairing or Swap pairings.", "Check every pairing is in the right place. Changing boxes can clear untouched draft fixtures, so generate fixtures again after finalising placements and before launching." ] },
      { id: "replacement", title: "Add from Standby", steps: ["Open Teams & players and find the correct competition, division and pairing. Use Add from Standby under the player slot you want to fill.", "Choose an available standby player from this competition or an earlier cycle of the same league. Singles are managed separately under Registrations. If both places are occupied, the selected slot’s current player moves to standby in the same operation.", "Review the player names, destinations, eligibility and upcoming fixtures. Tick the review box and confirm. Both roster and standby status update together."], note: "Players can be swapped or moved to and from standby without creating or claiming a Rallora account. Existing league registration windows do not prevent an administrator from managing the current draft or active cycle." },
      { id: "swap", title: "Swap Players", steps: ["Under the first player, choose Swap Players. Select another pairing in the same division and the player to exchange.", "Review both destination pairings, check the club’s rating and registration rules, tick the review box and confirm.", "Both players move together or neither moves. The team names and approved entry summaries automatically change to match the new pairings. Refresh if either pairing has changed since you opened the dialog. Cross-division swaps are blocked; review division placement separately." ] },
      { id: "standby", title: "Move to Standby", steps: ["Choose Move to Standby under the player leaving the pairing.", "Review the warning: this leaves a vacant place and may remove captain access. Tick the review box and confirm.", "The team name updates immediately to show the remaining player and a place to be confirmed; adding standby renames the pairing again. Add a standby player before the pairing’s next match. Moving a captain does not automatically promote the remaining player; the incoming player inherits the role of the slot being filled." ] },
      { id: "player-history", title: "Fixtures, results and troubleshooting", steps: ["Future fixtures stay with the same team and show its current players. Bookings and deadlines remain in place, so review court arrangements with the affected players.", "Recorded matches retain saved player names and their existing scores. Older matches use the roster available when snapshots were introduced; earlier unrecorded substitutions cannot be reconstructed. Standings remain attached to the team’s league place.", "If no standby players appear, check Registrations → Standby for this competition. Players already assigned elsewhere cannot be added again. Account claiming is not needed for these admin actions. Existing login access is updated where an account is linked; no account is created by a player movement.", "If a pairing changed or a standby player was taken, close the dialog, refresh Teams & players and review again. An error saves no part of the movement. Only authorised club administrators can make changes; each successful movement records its administrator, time and before/after rosters." ] },
    ], related: ["create-and-launch-competition", "registration-status", "captain-access"],
  },
  {
    slug: "club-reminders", category: "clubs", title: "Configure notifications and reminders", summary: "Choose what is sent, which channels are used and when messages can go out.",
    keywords: ["reminder", "reminders", "notification", "notifications", "email", "sending hours", "delivery", "chase", "overdue"],
    sections: [
      { id: "configure", title: "Set club communication preferences", steps: ["Open Notifications & reminders from club admin.", "Set the club time zone, sending hours and daily limit.", "Enable the reminder types you want. Choose Email and/or In-app for each type, set the available timing or repeat interval and save communication settings." ] },
      { id: "bookings", title: "Keep fixture information up to date", steps: ["Record agreed bookings or review matched Playtomic bookings so arrangement reminders can stop.", "Upcoming-match and missing-result reminders need a recorded booking. Check the arrangement if a reminder seems unexpected.", "Use Send reminder on an eligible fixture when needed and review the confirmation before sending. Club settings and sending limits still apply." ] },
      { id: "delivery", title: "Check message activity", steps: ["Review Recent delivery activity and refresh it to see queue status or errors.", "Accepted by email provider means the provider accepted the email; it does not prove it reached the recipient’s inbox.", "If a player is missing email, check their Rallora contact address and ask them to check spam. In-app notifications are available through their Rallora notification area." ] },
    ], related: ["arrange-a-match", "emails-and-ratings", "club-results"],
  },
  {
    slug: "club-results", category: "clubs", title: "Review results and resolve disputes", summary: "Monitor fixtures, investigate disagreements and correct official scores.",
    keywords: ["dispute", "disputed", "resolve", "official", "result", "override", "correction", "reopen", "standings", "points"],
    sections: [
      { id: "monitor", title: "Find the fixtures needing attention", steps: ["Use the fixture totals and filters in club admin to review To book, Booked, Awaiting result, Disputed result and Played.", "Open the result details for the correct fixture and check the pairings, submitted score and any dispute note.", "Ask the captains for clarification where needed before deciding the official result." ] },
      { id: "resolve", title: "Resolve or correct a result", steps: ["Use the dispute resolution or official-result tools for the selected fixture.", "Enter and check both scores and the winning pairing before saving. This changes the official result and standings.", "If an already-confirmed result needs further investigation, use the available reopen control or contact Rallora support. Check the public table after any correction."], note: "A court booking or finished Playtomic booking does not establish the official match score. The result is confirmed through Rallora’s result flow." },
    ], related: ["submit-and-confirm-results", "club-reminders", "playtomic-booking-matching"],
  },
  {
    slug: "connect-playtomic", category: "playtomic", title: "Connect your club to Playtomic", summary: "Enter the Venue ID, Client ID and Client Secret, then verify the connection.",
    keywords: ["playtomic", "integration", "connect", "api", "venue id", "client id", "client secret", "key", "champion", "master", "developer"],
    sections: [
      { id: "prepare", title: "Get your club’s API credentials", steps: ["The Rallora integration is intended for Playtomic Champion and Master clubs with External API access. Ask Playtomic if you are unsure about your entitlement.", "Sign in to Playtomic Manager as an authorised club administrator. Find the club’s External API or Developer Tools settings and generate credentials.", "Obtain the Venue ID for the correct club, plus the Client ID and matching Client Secret. If these are unavailable in your account, ask Playtomic support."], note: "Keep the Client Secret private. Do not send it to players or paste it into the help assistant or a support message." },
      { id: "verify", title: "Connect in Rallora", steps: ["Open Club admin, then Integrations.", "Enter Venue ID, Client ID and Client Secret in the matching fields. Press Connect & verify.", "Wait for the connected and verified state. Check any error shown before retrying. A wrong venue or mismatched credentials need correcting at source." ] },
      { id: "scope", title: "Understand the connection", steps: ["Rallora uses a read-only connection for supported booking matching and player rating lookups. It does not create, change or cancel court reservations.", "A complete automatic fixture match requires the four correct players. Official league scores are still submitted and reviewed in Rallora.", "Use Disconnect Playtomic in Integrations to remove the saved connection when needed. You can continue operating the league manually."], note: "The integration page shows verification and sync information. Connected does not guarantee every booking or player rating can be matched." },
    ], related: ["playtomic-booking-matching", "playtomic-without-api", "emails-and-ratings"],
  },
  {
    slug: "playtomic-booking-matching", category: "playtomic", title: "How Playtomic booking matching works", summary: "Understand full matches, pending bookings and results that still need entering.",
    keywords: ["playtomic", "booking", "matching", "4/4", "3/4", "pending", "sync", "live data", "court", "open match"],
    sections: [
      { id: "match", title: "What counts as a match", steps: ["Players book through Playtomic as usual using the correct player profiles.", "Rallora checks available booking data against league fixtures. A full automatic match requires all four fixture players to match.", "A partial or possible match, such as three of four players, can appear as Booking pending for the club to review. It is not a fully confirmed match." ] },
      { id: "missing", title: "If a booking is missing", steps: ["Check the club connection and sync information under Integrations.", "Confirm the correct venue and all four player profiles are on the booking, and check the players’ Playtomic emails in Rallora.", "If it still does not match, record the agreed booking manually and ask the organiser to investigate. Do not rely on a partial booking match as proof that the fixture is arranged." ] },
      { id: "played", title: "After the match", steps: ["A completed booking can indicate that a fixture is awaiting its result.", "The captain still submits the score in Rallora and the opposing captain confirms or disputes it.", "Only the official result updates the league standings. Booking status alone does not award points." ] },
    ], related: ["connect-playtomic", "arrange-a-match", "submit-and-confirm-results"],
  },
  {
    slug: "playtomic-without-api", category: "playtomic", title: "Run a league without Playtomic connected", summary: "Use manual ratings and agreed bookings, and connect later if the club chooses.",
    keywords: ["without", "manual", "no api", "refuse", "later", "disconnect", "offline", "rating", "booking"],
    sections: [
      { id: "manual", title: "Run the normal league flow", steps: ["Players register in Rallora and supply current ratings where requested. The club reviews entries and places the pairs.", "Captains arrange and reserve courts through the club’s usual booking provider.", "Captains use Record agreed booking in Rallora, then submit and confirm scores after playing. Club reminders use the recorded arrangement and saved communication settings." ] },
      { id: "later", title: "Connect later", steps: ["Keep players’ correct Playtomic emails on their Rallora details so later matching and lookups have the required identifiers.", "When the club is ready, connect and verify its credentials under Integrations. Existing Rallora accounts and registrations do not need to be recreated.", "Check available player ratings and future booking matches after connection. A connection does not guarantee a missing rating can be found or that earlier bookings will be imported." ] },
    ], related: ["arrange-a-match", "connect-playtomic", "emails-and-ratings"],
  },
];

export function safeClubSlug(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100 ? value : "";
}
export function helpHref(article = "", club = ""): string {
  return `/help${article ? `/${article}` : ""}${safeClubSlug(club) ? `?club=${encodeURIComponent(club)}` : ""}`;
}
const STOP_WORDS = new Set("a an the i my me we our you your to how do does can is are it in on for of and with where what why not have has get please help want need im ive cant cannot".split(" "));
const NORMALISATIONS: Record<string, string> = { bookings: "booking", booked: "booking", book: "booking", ratings: "rating", reminders: "reminder", results: "result", scores: "score", teams: "team", players: "player", divisions: "division", emails: "email", registering: "register", signup: "register", registration: "register", signing: "login", signin: "login", notifications: "notification" };
function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9/]+/g, " ").trim().split(/\s+/).filter(t => t && !STOP_WORDS.has(t)).map(t => NORMALISATIONS[t] ?? t))];
}
export function searchHelp(query: string, category?: HelpCategory): HelpArticle[] {
  const pool = HELP_ARTICLES.filter(a => !category || a.category === category);
  const terms = tokens(query);
  if (!terms.length) return query.trim() ? [] : pool;
  return pool.map(article => {
    const title = new Set(tokens(article.title));
    const keywords = new Set(tokens(article.keywords.join(" ")));
    const body = new Set(tokens([article.summary, ...article.sections.flatMap(s => [s.title, ...s.steps, s.note ?? ""])].join(" ")));
    const score = terms.reduce((total, term) => total + (title.has(term) ? 6 : keywords.has(term) ? 4 : body.has(term) ? 1 : 0), 0);
    const matches = terms.filter(term => title.has(term) || keywords.has(term) || body.has(term)).length;
    return { article, score, matches };
  }).filter(r => r.score >= 4 && r.matches >= Math.ceil(terms.length / 2)).sort((a, b) => b.score - a.score).map(r => r.article);
}
export function suggestedHelp(path: string): string[] {
  if (path.includes("/admin/late-entry") || path.includes("/admin/registrations")) return ["add-late-team", "manage-teams-and-entries", "registration-status"];

  if (path.includes("/admin/integrations")) return ["connect-playtomic", "playtomic-booking-matching", "playtomic-without-api"];
  if (path.includes("/admin/reminders")) return ["club-reminders", "emails-and-ratings", "arrange-a-match"];
  if (path.includes("/admin/registrations")) return ["manage-teams-and-entries", "registration-status", "create-and-launch-competition"];
  if (path.includes("/admin")) return ["create-and-launch-competition", "manage-teams-and-entries", "club-results"];
  if (path.includes("/captain")) return ["arrange-a-match", "submit-and-confirm-results", "captain-access"];
  if (/\/(register|join-team)(\/|$)/.test(path)) return ["join-a-league", "registration-status", "emails-and-ratings"];
  if (/\/(login|account)(\/|$)/.test(path)) return ["emails-and-ratings", "captain-access", "registration-status"];
  return ["view-league-fixtures", "join-a-league", "captain-access"];
}

/** Select a relevant section rather than always repeating the start of a guide. */
export function helpAnswerSection(article: HelpArticle, query: string): HelpSection {
  const terms = tokens(query);
  const ranked = article.sections.map(section => {
    const title = new Set(tokens(section.title));
    const body = new Set(tokens([...section.steps, section.note ?? ""].join(" ")));
    return { section, score: terms.reduce((total, term) => total + (title.has(term) ? 5 : body.has(term) ? 1 : 0), 0) };
  }).sort((a, b) => b.score - a.score);
  return ranked[0].section;
}
