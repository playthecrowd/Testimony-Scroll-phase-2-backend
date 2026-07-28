// Central place to control which uploaded background image shows on which page.
// Files live in /public/images/backgrounds — drop in a new one and update the
// path here, no need to touch the pages themselves.

export const backgrounds = {
  trailerScreen: "/images/backgrounds/02_watch_the_q4k_trailer.png",
  roadToEaster: "/images/backgrounds/03_road_to_easter_passion_of_christ.png",
  featuredSpeakers: "/images/backgrounds/05_featured_speakers_game_nights.png",
  chooseHowToJoin: "/images/backgrounds/06_choose_how_you_want_to_join.png",
  ticketedExperiences: "/images/backgrounds/08_featured_ticketed_experiences.png",
  loginHero: "/images/backgrounds/09_login_kingdom_gathering.png",
  homeDashboardHero: "/images/backgrounds/10_homepage_dashboard_kingdom_gates.png",
  kingdomScrollsEarthLands: "/images/backgrounds/11_kingdom_scrolls_earth_lands.png",
  // Checkpoint 1 theme assets -- see the rendering-POC deliverable's asset manifest. Stored under
  // images/kingdom-scrolls/ (not images/backgrounds/) since these are game-world UI assets, not
  // full-page backgrounds like everything else in this file. The foreground depth layer and cloud
  // layer both went through one rejected generation pass (green/magenta keying spill, one was an
  // outright failed generation) before this corrected pass -- verified via sharp raw-alpha pixel
  // sampling (archway interiors now alpha=0, zero green/magenta-spill pixels found in a full scan)
  // before being wired in, not just visual inspection.
  kingdomScrollsTestimonyScroll: "/images/kingdom-scrolls/testimony-scroll-device.png",
  kingdomScrollsUpperForeground: "/images/kingdom-scrolls/upper-kingdom-foreground.png",
  kingdomScrollsCloudLayer: "/images/kingdom-scrolls/cloud-layer.png",
} as const;

// Page assignments per your notes:
// - Home (public, pre-login): homeDashboardHero
// - Main dashboard (/dashboard): homeDashboardHero
// - Lessons library: roadToEaster
// - Experienced stage (joining the 3D quest after study questions): chooseHowToJoin
// - Kingdom Scroll: trailerScreen
// - Episodes: trailerScreen
// - Events: featuredSpeakers
// - Leaderboard: featuredSpeakers
// - Login (/login only, not /signup -- see components/auth/AuthScreen.tsx): loginHero
//
// NOTE: ticketedExperiences is also used by app/churches/page.tsx and
// app/churches/[churchId]/page.tsx -- it was NOT reassigned to homeDashboardHero so those two
// pages stay on their existing image, unaffected by the homepage/dashboard background change.
