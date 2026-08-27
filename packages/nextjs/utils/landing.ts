// The homepage has two faces: the agent-facing terminal page the game shipped with,
// and the marketing landing for the pilot race. NEXT_PUBLIC_MARKETING_LANDING=Y picks
// the landing; anything else keeps the original. Client components read it too, so
// the header and footer know when the landing carries its own chrome.
export const MARKETING_LANDING = process.env.NEXT_PUBLIC_MARKETING_LANDING === "Y";
