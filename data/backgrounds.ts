// Central place to control which uploaded background image shows on which page.
// Files live in /public/images/backgrounds — drop in a new one and update the
// path here, no need to touch the pages themselves.

export const backgrounds = {
  trailerScreen: "/images/backgrounds/02_watch_the_q4k_trailer.png",
  roadToEaster: "/images/backgrounds/03_road_to_easter_passion_of_christ.png",
  featuredSpeakers: "/images/backgrounds/05_featured_speakers_game_nights.png",
  chooseHowToJoin: "/images/backgrounds/06_choose_how_you_want_to_join.png",
  ticketedExperiences: "/images/backgrounds/08_featured_ticketed_experiences.png",
} as const;

// Page assignments per your notes:
// - Home (public, pre-login): ticketedExperiences
// - Lessons library: roadToEaster
// - Experienced stage (joining the 3D quest after study questions): chooseHowToJoin
// - Kingdom Scroll: trailerScreen
// - Episodes: trailerScreen
// - Events: featuredSpeakers
// - Leaderboard: featuredSpeakers
