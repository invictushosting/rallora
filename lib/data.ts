export type TeamRow = {
  id?: string;
  name: string;
  playerOneName?: string | null;
  playerTwoName?: string | null;
  captainEmail?: string | null;
  isActive?: boolean | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  diff: number;
  points: number;
};

export type Division = {
  id: string;
  name: string;
  sortOrder: number;
  teams: TeamRow[];
};

export type Fixture = {
  id?: string;
  division: string;
  week: string;
  date: string;
  deadline: string;
  home: string;
  away: string;
  court: string;
  status: "Open" | "Submitted" | "Confirmed" | "Disputed" | "Forfeit" | "Double Forfeit";
};

export type ResultRow = {
  division: string;
  teams: string;
  score: string;
  status: string;
};

export type Announcement = {
  title: string;
  body: string;
};

export type Sponsor = {
  name: string;
  sponsorType?: string | null;
  placement?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
};

export type LeagueData = {
  seasonName: string;
  divisions: Division[];
  fixtures: Fixture[];
  results: ResultRow[];
  sponsors: Sponsor[];
  announcements: Announcement[];
};

export const fallbackData: LeagueData = {
  seasonName: "Spring 2025",
  divisions: [
    {
      id: "1",
      name: "Division 1",
      sortOrder: 1,
      teams: [
        { name: "The Smash Bros", played: 5, won: 4, drawn: 0, lost: 1, diff: 18, points: 12 },
        { name: "Padel Kings", played: 5, won: 4, drawn: 0, lost: 1, diff: 14, points: 12 },
        { name: "Court Crushers", played: 5, won: 3, drawn: 0, lost: 2, diff: 6, points: 9 },
        { name: "Net Ninjas", played: 5, won: 3, drawn: 0, lost: 2, diff: 2, points: 9 },
        { name: "Drop Shot Demons", played: 5, won: 2, drawn: 0, lost: 3, diff: -2, points: 6 },
        { name: "The Volleyers", played: 5, won: 2, drawn: 0, lost: 3, diff: -6, points: 6 },
        { name: "GSM Warriors", played: 5, won: 1, drawn: 0, lost: 4, diff: -12, points: 3 },
        { name: "Basement Bandits", played: 5, won: 0, drawn: 0, lost: 5, diff: -20, points: 0 },
      ],
    },
    {
      id: "2",
      name: "Division 2",
      sortOrder: 2,
      teams: [
        { name: "Topspin Legends", played: 5, won: 4, drawn: 1, lost: 0, diff: 16, points: 13 },
        { name: "Padel Crew", played: 5, won: 4, drawn: 0, lost: 1, diff: 11, points: 12 },
        { name: "Back Glass Boys", played: 5, won: 3, drawn: 1, lost: 1, diff: 8, points: 10 },
        { name: "Serve Aces", played: 5, won: 3, drawn: 0, lost: 2, diff: 5, points: 9 },
        { name: "Wall Runners", played: 5, won: 2, drawn: 0, lost: 3, diff: -1, points: 6 },
        { name: "Lob Stars", played: 5, won: 2, drawn: 0, lost: 3, diff: -5, points: 6 },
        { name: "Side Glass Saints", played: 5, won: 1, drawn: 0, lost: 4, diff: -12, points: 3 },
        { name: "No Mercy", played: 5, won: 0, drawn: 0, lost: 5, diff: -22, points: 0 },
      ],
    },
    {
      id: "3",
      name: "Division 3",
      sortOrder: 3,
      teams: [
        { name: "Court Kings", played: 5, won: 4, drawn: 0, lost: 1, diff: 13, points: 12 },
        { name: "Racket Rebels", played: 5, won: 4, drawn: 0, lost: 1, diff: 12, points: 12 },
        { name: "Smash Society", played: 5, won: 3, drawn: 1, lost: 1, diff: 9, points: 10 },
        { name: "Blue Ballers", played: 5, won: 3, drawn: 0, lost: 2, diff: 5, points: 9 },
        { name: "First Timers", played: 5, won: 2, drawn: 0, lost: 3, diff: -4, points: 6 },
        { name: "Glass Masters", played: 5, won: 1, drawn: 1, lost: 3, diff: -8, points: 4 },
        { name: "Match Makers", played: 5, won: 1, drawn: 0, lost: 4, diff: -11, points: 3 },
        { name: "Happy Hitters", played: 5, won: 0, drawn: 0, lost: 5, diff: -16, points: 0 },
      ],
    },
  ],
  fixtures: [
    { division: "Div 1", week: "Week 6", date: "Sun 25 May", deadline: "01 Jun", home: "The Smash Bros", away: "Padel Kings", court: "Arrange", status: "Open" },
    { division: "Div 2", week: "Week 6", date: "Sun 25 May", deadline: "01 Jun", home: "Topspin Legends", away: "Padel Crew", court: "Arrange", status: "Open" },
    { division: "Div 3", week: "Week 6", date: "Sun 25 May", deadline: "01 Jun", home: "Court Kings", away: "Racket Rebels", court: "Arrange", status: "Open" },
  ],
  results: [],
  sponsors: [
    { name: "GSM Padel", sponsorType: "League Sponsor" },
    { name: "Bullpadel", sponsorType: "Equipment Partner" },
    { name: "NOX", sponsorType: "Official Partner" },
    { name: "Siux", sponsorType: "Official Partner" },
    { name: "Shoot", sponsorType: "Court Partner" },
    { name: "Physio Partner", sponsorType: "Wellness Partner" },
  ],
  announcements: [
    {
      title: "Fixtures for Week 6 released",
      body: "Week 6 fixtures are now live. Please arrange your match and submit your result before Sunday 1 June.",
    },
  ],
};
