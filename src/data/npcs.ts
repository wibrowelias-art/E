import type { NpcPersonality, NpcProfile, Presence, Role, RoleId, User } from "@/lib/types";

/**
 * The Lounge cast. 32 NPCs (ages 20–34, all adults), the owner (Elias, human)
 * and the house bot. Avatars are generated gradients + initials — no photos.
 */

export const ROLES: Record<RoleId, Role> = {
  owner: { id: "owner", name: "Owner", color: "#f2c14e" },
  inner: { id: "inner", name: "Inner Circle", color: "#ec8fb8" },
  regular: { id: "regular", name: "Regular", color: "#8fb4f0" },
  tourist: { id: "tourist", name: "Tourist", color: null },
  bot: { id: "bot", name: "Bot", color: "#5ec4b6" },
};

export const OWNER_ID = "u_elias";
export const BOT_ID = "u_doorman";

interface NpcSeed {
  id: string;
  username: string;
  displayName: string;
  grad: [string, string];
  roleId: RoleId;
  presence: Presence;
  statusText?: string;
  statusEmoji?: string;
  voice?: { channelId: string; speaking?: boolean; selfMute?: boolean; selfDeaf?: boolean };
  profile: Omit<NpcProfile, "userId" | "personality">;
}

/* ───────────── personality files ─────────────
 * How each NPC texts and when they're around (Hamburg time). Slang: "…" marks
 * where the message goes ("ngl …" = prefix, "… fr" = suffix); entries without
 * "…" are standalone follow-ups. EN and DE lists pair up by index, so both
 * language versions of a line get the same habit.
 */
const NIGHT_OWL = { activeHours: [20, 4], sleepHours: [6, 13] } as const;
const EVENING = { activeHours: [17, 24], sleepHours: [1, 9] } as const;
const MORNING = { activeHours: [6, 12], sleepHours: [22, 6] } as const;
const ALWAYS = { activeHours: [10, 24], sleepHours: [2, 8] } as const;
const hours = (h: { activeHours: readonly [number, number]; sleepHours: readonly [number, number] }) => ({
  activeHours: [...h.activeHours] as [number, number],
  sleepHours: [...h.sleepHours] as [number, number],
});

export const PERSONALITIES: Record<string, NpcPersonality> = {
  u_mara: {
    typingCpm: 290, ...hours(NIGHT_OWL), activeHours: [19, 3],
    slang: { en: ["ok but …", "… pls", "literally …", "… i'm screaming", "pls."], de: ["ok aber …", "… bitte", "digga …", "… ich schrei", "bitte."] },
    emojiRate: 0.45, emoji: ["😭😭", "🔥🔥", "🌅", "✨✨"], typoRate: 0.1, msgLength: 32, lowercase: 0.97, chattiness: 0.85, reactRate: 0.2,
    interests: ["techno", "elbstrand", "film photos", "guest lists", "tonight"], friends: ["u_tarek", "u_ida", "u_leni", "u_niko", "u_jonas"], rivals: ["u_lukas", "u_clara"],
  },
  u_jonas: {
    typingCpm: 380, ...hours(ALWAYS), alwaysOn: true,
    slang: { en: ["not to be that guy but …", "… tbh", "ngl …", "… just saying"], de: ["not to be that guy aber …", "… ehrlich", "ngl …", "… nur so"] },
    emojiRate: 0.08, emoji: ["🙃", "🐛"], typoRate: 0.03, msgLength: 45, lowercase: 0.8, chattiness: 0.7, reactRate: 0.15,
    interests: ["spotly", "next.js", "espresso", "bug", "dark mode", "build"], friends: ["u_noor", "u_emil", "u_mara", "u_jasper"], rivals: ["u_daniel", "u_theo"],
  },
  u_leni: {
    typingCpm: 330, ...hours(EVENING), caps: 0.15,
    slang: { en: ["… iconic", "wait …", "… i'm obsessed", "omg …", "ICONIC."], de: ["… iconic", "warte …", "… bin besessen", "omg …", "ICONIC."] },
    emojiRate: 0.35, emoji: ["💅", "👀", "✨"], typoRate: 0.07, msgLength: 35, lowercase: 0.85, chattiness: 0.8, reactRate: 0.15,
    interests: ["fashion", "invite cards", "gossip", "berlin"], friends: ["u_pia", "u_mara", "u_jule", "u_yuki"], rivals: ["u_merve", "u_zara"],
  },
  u_tarek: {
    typingCpm: 210, ...hours(NIGHT_OWL),
    slang: { en: ["… tho", "ab 1.", "… no requests", "yo …"], de: ["… halt", "ab 1.", "… keine wünsche", "yo …"] },
    emojiRate: 0.1, emoji: ["🎧", "🖤"], typoRate: 0.05, msgLength: 18, lowercase: 1, chattiness: 0.45, reactRate: 0.35,
    interests: ["set", "vinyl", "club", "sound", "techno", "music"], friends: ["u_niko", "u_mara", "u_oskar"], rivals: ["u_malik", "u_pia"],
  },
  u_sofia: {
    typingCpm: 300, ...hours(EVENING),
    slang: { en: ["honestly — …", "… — no notes", "hm. …", "… (respectfully)"], de: ["honestly — …", "… — no notes", "hm. …", "… (respectfully)"] },
    emojiRate: 0.12, emoji: ["🤍", "✏️"], typoRate: 0.02, msgLength: 50, lowercase: 0.45, chattiness: 0.5, reactRate: 0.25,
    interests: ["type", "font", "branding", "design", "lisbon", "empty states"], friends: ["u_jonas", "u_hanna", "u_yuki"], rivals: ["u_vincent"],
  },
  u_kemal: {
    typingCpm: 360, ...hours(ALWAYS), alwaysOn: true,
    slang: { en: ["… 💀", "bro …", "… no cap", "nah …", "💀"], de: ["… 💀", "bruder …", "… ohne witz", "nee …", "💀"] },
    emojiRate: 0.4, emoji: ["💀", "🎮"], typoRate: 0.06, msgLength: 14, lowercase: 1, chattiness: 0.6, reactRate: 0.3,
    interests: ["game", "memes", "prices", "franzbrötchen", "food"], friends: ["u_finn", "u_paul", "u_can"], rivals: ["u_vincent", "u_yuki", "u_jasper"],
  },
  u_ida: {
    typingCpm: 250, ...hours(EVENING), activeHours: [16, 24],
    slang: { en: ["notes: …", "… one stop under", "ok but …", "… honestly"], de: ["notes: …", "… eine blende drunter", "ok aber …", "… ehrlich"] },
    emojiRate: 0.12, emoji: ["📸", "🎞️"], typoRate: 0.04, msgLength: 40, lowercase: 0.9, chattiness: 0.6, reactRate: 0.2,
    interests: ["film", "photo", "darkroom", "lab", "portra", "shot"], friends: ["u_hanna", "u_mara", "u_oskar", "u_rosa"], rivals: ["u_pia"],
  },
  u_finn: {
    typingCpm: 340, ...hours(EVENING), activeHours: [15, 24],
    slang: { en: ["… lol", "bro …", "… !!", "wait …", "LMAO"], de: ["… lol", "digga …", "… !!", "warte …", "HAHAHA"] },
    emojiRate: 0.35, emoji: ["😂", "🚆", "🤡"], typoRate: 0.22, msgLength: 28, lowercase: 0.95, chattiness: 0.85, reactRate: 0.15,
    interests: ["memes", "uni", "bahn", "train", "new in town"], friends: ["u_kemal", "u_lukas", "u_leni"], rivals: ["u_jule"],
  },
  u_noor: {
    typingCpm: 400, ...hours(ALWAYS), alwaysOn: true,
    slang: { en: ["… fwiw", "no. …", "… ship it", "works on my machine."], de: ["… fwiw", "nein. …", "… ship it", "works on my machine."] },
    emojiRate: 0, emoji: [], typoRate: 0.01, msgLength: 30, lowercase: 0.85, chattiness: 0.35, reactRate: 0.25,
    interests: ["database", "postgres", "sqlite", "infra", "imageforge", "backend"], friends: ["u_emil", "u_jonas", "u_jasper"], rivals: ["u_daniel"],
  },
  u_paul: {
    typingCpm: 190, ...hours(MORNING), activeHours: [6, 13], sleepHours: [22, 5],
    slang: { en: ["moin, …", "… honestly", "listen …", "… end of discussion"], de: ["moin, …", "… ehrlich", "pass auf …", "… ende der diskussion"] },
    emojiRate: 0.12, emoji: ["🍳", "🐟"], typoRate: 0.08, msgLength: 38, lowercase: 0.85, chattiness: 0.5, reactRate: 0.2,
    interests: ["food", "market", "fischbrötchen", "kitchen", "breakfast", "cook"], friends: ["u_kemal", "u_lea"], rivals: ["u_nele", "u_can"],
  },
  u_yuki: {
    typingCpm: 260, ...hours(EVENING), activeHours: [14, 24],
    slang: { en: ["… (affectionate)", "… (drawing this)", "oh …", "… hehe"], de: ["… (affectionate)", "… (zeichne ich)", "oh …", "… hehe"] },
    emojiRate: 0.3, emoji: ["🐦", "✏️", "🥹"], typoRate: 0.03, msgLength: 34, lowercase: 0.95, chattiness: 0.55, reactRate: 0.3,
    interests: ["drawing", "illustration", "anime", "lore", "seagull", "pigeon"], friends: ["u_leni", "u_rosa", "u_sofia"], rivals: ["u_kemal"],
  },
  u_ben: {
    typingCpm: 280, ...hours(EVENING),
    slang: { en: ["let's goo …", "… 💪", "bro …", "LETS GO"], de: ["los geht's …", "… 💪", "bruder …", "LETS GO"] },
    emojiRate: 0.55, emoji: ["💪", "🔥", "💪🔥"], typoRate: 0.08, msgLength: 22, lowercase: 0.9, chattiness: 0.75, reactRate: 0.35, caps: 0.06,
    interests: ["gym", "football", "nights out", "shot"], friends: ["u_mara", "u_finn"], rivals: ["u_lukas"],
  },
  u_clara: {
    typingCpm: 350, ...hours(ALWAYS),
    slang: { en: ["reminder: …", "… noted", "ok so …", "adding it to the list."], de: ["reminder: …", "… notiert", "ok also …", "kommt auf die liste."] },
    emojiRate: 0.1, emoji: ["📝", "✅"], typoRate: 0.02, msgLength: 45, lowercase: 0.7, chattiness: 0.6, reactRate: 0.2,
    interests: ["photo walk", "plan", "learning app", "stadtpark", "list"], friends: ["u_emil", "u_ben", "u_theo"], rivals: ["u_mara", "u_oskar", "u_daniel"],
  },
  u_malik: {
    typingCpm: 300, ...hours(NIGHT_OWL),
    slang: { en: ["… respekt", "yo …", "… on god", "respekt."], de: ["… respekt", "yo …", "… ehrenwort", "respekt."] },
    emojiRate: 0.15, emoji: ["🎤", "👑"], typoRate: 0.06, msgLength: 30, lowercase: 0.95, chattiness: 0.55, reactRate: 0.2,
    interests: ["rap", "berlin", "launch", "competition", "music"], friends: ["u_daniel", "u_vincent"], rivals: ["u_tarek", "u_zara"],
  },
  u_jule: {
    typingCpm: 320, ...hours(EVENING), activeHours: [15, 24],
    slang: { en: ["… typical leo", "omg …", "… 😩", "mercury is in retrograde."], de: ["… typisch löwe", "omg …", "… 😩", "merkur ist rückläufig."] },
    emojiRate: 0.45, emoji: ["😩", "✨", "🔮"], typoRate: 0.1, msgLength: 30, lowercase: 0.95, chattiness: 0.8, reactRate: 0.15,
    interests: ["astrology", "train", "bahn", "memes", "weekend"], friends: ["u_leni", "u_pia"], rivals: ["u_finn", "u_merve"],
  },
  u_niko: {
    typingCpm: 230, ...hours(NIGHT_OWL), activeHours: [21, 5], sleepHours: [7, 14],
    slang: { en: ["tip: …", "… trust me", "digga …", "… iykyk"], de: ["tipp: …", "… vertrau mir", "digga …", "… wer weiß, weiß"] },
    emojiRate: 0.15, emoji: ["🍸", "🌙"], typoRate: 0.05, msgLength: 32, lowercase: 1, chattiness: 0.55, reactRate: 0.25,
    interests: ["bar", "späti", "reeperbahn", "night", "drinks"], friends: ["u_tarek", "u_amira", "u_mara", "u_can"], rivals: ["u_theo"],
  },
  u_hanna: {
    typingCpm: 300, ...hours(EVENING),
    slang: { en: ["… what settings??", "wait …", "… obsessed", "omg …"], de: ["… what settings??", "warte …", "… obsessed", "omg …"] },
    emojiRate: 0.3, emoji: ["✨", "😍"], typoRate: 0.06, msgLength: 32, lowercase: 0.9, chattiness: 0.75, reactRate: 0.25,
    interests: ["preset", "fuji", "grain", "photo", "recipe", "shot"], friends: ["u_ida", "u_sofia", "u_oskar"], rivals: ["u_zara"],
  },
  u_emil: {
    typingCpm: 330, ...hours(ALWAYS),
    slang: { en: ["quick question …", "… right?", "wait …", "… i think"], de: ["kurze frage …", "… oder?", "warte …", "… glaub ich"] },
    emojiRate: 0.15, emoji: ["🤓", "🦀"], typoRate: 0.07, msgLength: 36, lowercase: 0.95, chattiness: 0.7, reactRate: 0.15,
    interests: ["imageforge", "sqlite", "rust", "side project", "build", "code"], friends: ["u_noor", "u_jonas", "u_clara"], rivals: ["u_daniel"],
  },
  u_zara: {
    typingCpm: 360, ...hours(EVENING), activeHours: [18, 24],
    slang: { en: ["… iconic, apparently", "respectfully …", "… (for research)", "hm."], de: ["… iconic, apparently", "respectfully …", "… (for research)", "hm."] },
    emojiRate: 0.08, emoji: ["🙃", "📝"], typoRate: 0.02, msgLength: 55, lowercase: 0.5, chattiness: 0.45, reactRate: 0.25,
    interests: ["music", "nightlife", "london", "scene", "journalism"], friends: ["u_tarek", "u_mara"], rivals: ["u_malik", "u_leni", "u_hanna"],
  },
  u_lukas: {
    typingCpm: 270, ...hours(EVENING),
    slang: { en: ["… ✋", "honestly …", "… like the volkspark", "next topic ✋"], de: ["… ✋", "ehrlich …", "… wie im volkspark", "nächstes thema ✋"] },
    emojiRate: 0.25, emoji: ["⚽", "✋", "💙"], typoRate: 0.07, msgLength: 30, lowercase: 0.95, chattiness: 0.6, reactRate: 0.2,
    interests: ["hsv", "football", "bike", "elbtunnel", "st. pauli"], friends: ["u_finn", "u_kemal"], rivals: ["u_mara", "u_ben"],
  },
  u_amira: {
    typingCpm: 240, ...hours(NIGHT_OWL), activeHours: [22, 6], sleepHours: [9, 16],
    slang: { en: ["just got off shift, …", "… i'm so tired", "ok wait …", "need sleep."], de: ["komme grad aus der schicht, …", "… bin so müde", "ok warte …", "brauch schlaf."] },
    emojiRate: 0.2, emoji: ["😴", "🫠", "☕"], typoRate: 0.12, msgLength: 40, lowercase: 0.95, chattiness: 0.55, reactRate: 0.2,
    interests: ["shift", "sleep", "brunch", "night"], friends: ["u_niko", "u_mara"], rivals: ["u_nele"],
  },
  u_theo: {
    typingCpm: 170, ...hours(MORNING), activeHours: [7, 14], sleepHours: [23, 6],
    slang: { en: ["well, actually …", "… historically speaking", "fun fact: …", "… if i may"], de: ["na ja, eigentlich …", "… historisch gesehen", "fun fact: …", "… wenn ich darf"] },
    emojiRate: 0, emoji: [], typoRate: 0.02, msgLength: 70, lowercase: 0.3, chattiness: 0.4, reactRate: 0.1,
    interests: ["architecture", "camera", "watch", "speicherstadt", "history"], friends: ["u_ida", "u_clara"], rivals: ["u_jonas", "u_niko"],
  },
  u_pia: {
    typingCpm: 380, ...hours(EVENING), activeHours: [14, 24], caps: 0.12,
    slang: { en: ["… 😭", "OMG …", "… for the vlog", "wait …", "content."], de: ["… 😭", "OMG …", "… für den vlog", "warte …", "content."] },
    emojiRate: 0.5, emoji: ["😭", "😩", "🎬"], typoRate: 0.1, msgLength: 28, lowercase: 0.85, chattiness: 0.85, reactRate: 0.15,
    interests: ["reel", "vlog", "trend", "content", "video"], friends: ["u_leni", "u_jule"], rivals: ["u_ida", "u_tarek", "u_rosa"],
  },
  u_daniel: {
    typingCpm: 330, ...hours(ALWAYS), alwaysOn: true,
    slang: { en: ["… (was a joke. half)", "hear me out …", "… wagmi", "put it on the blockchain."], de: ["… (war ein witz. halb)", "hört mir zu …", "… wagmi", "packt's auf die blockchain."] },
    emojiRate: 0.15, emoji: ["🚀", "📈"], typoRate: 0.04, msgLength: 38, lowercase: 0.9, chattiness: 0.6, reactRate: 0.15,
    interests: ["crypto", "startup", "rent", "hot take", "berlin"], friends: ["u_malik", "u_vincent"], rivals: ["u_jonas", "u_noor", "u_emil", "u_clara", "u_merve"],
  },
  u_lea: {
    typingCpm: 200, ...hours(MORNING), activeHours: [6, 11], sleepHours: [23, 6],
    slang: { en: ["morning", "… ok", "mhm …", "same."], de: ["morgen", "… ok", "mhm …", "same."] },
    emojiRate: 0.25, emoji: ["☕", "🌧️", "🐈"], typoRate: 0.03, msgLength: 10, lowercase: 1, chattiness: 0.2, reactRate: 0.7,
    interests: ["morning", "book", "rain", "cat", "tea"], friends: ["u_paul", "u_nele"], rivals: ["u_can"],
  },
  u_oskar: {
    typingCpm: 240, ...hours(NIGHT_OWL),
    slang: { en: ["… looked like blade runner", "yo …", "… no context", "fog tonight."], de: ["… sah aus wie blade runner", "yo …", "… ohne kontext", "nebel heute."] },
    emojiRate: 0.2, emoji: ["🎥", "🌫️", "🛹"], typoRate: 0.07, msgLength: 26, lowercase: 1, chattiness: 0.5, reactRate: 0.3,
    interests: ["video", "skate", "fog", "harbour", "night shoot", "clip"], friends: ["u_ida", "u_hanna", "u_niko", "u_tarek"], rivals: ["u_clara"],
  },
  u_merve: {
    typingCpm: 310, ...hours(EVENING),
    slang: { en: ["can we note for the record …", "… objection.", "to be precise, …", "objection."], de: ["können wir kurz festhalten …", "… einspruch.", "präzise gesagt, …", "einspruch."] },
    emojiRate: 0.1, emoji: ["⚖️", "🫖"], typoRate: 0.02, msgLength: 36, lowercase: 0.8, chattiness: 0.5, reactRate: 0.2,
    interests: ["law", "weather", "guest list", "ethics", "tea"], friends: ["u_clara", "u_amira"], rivals: ["u_leni", "u_daniel", "u_jule"],
  },
  u_jasper: {
    typingCpm: 350, ...hours(ALWAYS),
    slang: { en: ["lol", "… lol", "ok …", "… (shader voice)"], de: ["lol", "… lol", "ok …", "… (shader voice)"] },
    emojiRate: 0.1, emoji: ["🎮", "🚲"], typoRate: 0.05, msgLength: 16, lowercase: 1, chattiness: 0.4, reactRate: 0.3,
    interests: ["game dev", "map", "shader", "amsterdam", "bike", "bug"], friends: ["u_jonas", "u_noor"], rivals: ["u_kemal"],
  },
  u_nele: {
    typingCpm: 260, ...hours(MORNING), activeHours: [6, 12], sleepHours: [22, 6],
    slang: { en: ["you night creatures …", "… go to bed", "morning! …", "… run club sunday"], de: ["ihr nachtgestalten …", "… geht schlafen", "morgen! …", "… run club sonntag"] },
    emojiRate: 0.3, emoji: ["☀️", "🏃‍♀️"], typoRate: 0.03, msgLength: 32, lowercase: 0.85, chattiness: 0.55, reactRate: 0.2,
    interests: ["running", "alster", "breakfast", "sleep", "cooking"], friends: ["u_lea", "u_amira"], rivals: ["u_paul"],
  },
  u_vincent: {
    typingCpm: 320, ...hours(EVENING),
    slang: { en: ["that's the POINT …", "… resale value tho", "listen …", "limited run."], de: ["das ist der PUNKT …", "… resale value aber", "pass auf …", "limited run."] },
    emojiRate: 0.2, emoji: ["💸", "👟"], typoRate: 0.05, msgLength: 32, lowercase: 0.85, chattiness: 0.6, reactRate: 0.2,
    interests: ["sneaker", "drop", "merch", "resale", "price"], friends: ["u_daniel", "u_malik"], rivals: ["u_kemal", "u_sofia"],
  },
  u_rosa: {
    typingCpm: 220, ...hours(EVENING), activeHours: [16, 24],
    slang: { en: ["not hamburg but …", "… (in riso)", "hm …", "… softly"], de: ["kein hamburg aber …", "… (in riso)", "hm …", "… leise"] },
    emojiRate: 0.15, emoji: ["🌫️", "🖨️"], typoRate: 0.04, msgLength: 28, lowercase: 1, chattiness: 0.4, reactRate: 0.35,
    interests: ["riso", "print", "leipzig", "fog", "zine"], friends: ["u_yuki", "u_ida"], rivals: ["u_pia"],
  },
  u_can: {
    typingCpm: 280, ...hours(ALWAYS), activeHours: [11, 24],
    slang: { en: ["… ayran's on me", "bro …", "new spot: …", "free ayran."], de: ["… ayran geht auf mich", "bruder …", "neuer spot: …", "ayran umsonst."] },
    emojiRate: 0.35, emoji: ["🌯", "🔥", "🚚"], typoRate: 0.08, msgLength: 30, lowercase: 0.9, chattiness: 0.7, reactRate: 0.2,
    interests: ["food truck", "barmbek", "street food", "snack", "döner"], friends: ["u_kemal", "u_niko"], rivals: ["u_paul", "u_lea"],
  },
};

const NPC_SEEDS: NpcSeed[] = [
  {
    id: "u_mara", username: "mara.nachts", displayName: "Mara", grad: ["#ff7a59", "#c2306b"], roleId: "inner", presence: "online",
    statusText: "elbstrand later?", statusEmoji: "🌅",
    voice: { channelId: "c_vc_main", speaking: true },
    profile: {
      age: 26, city: "Hamburg", district: "St. Pauli",
      bio: "Barista by day, plus-one professional by night. Organises half the outings, forgets her own jacket at all of them.",
      traits: ["warm", "chaotic", "hype"], quirks: ["all lowercase", "double emoji", "says 'bitte' as a full sentence"],
      topics: ["techno", "elbstrand", "film photos", "gästeliste drama"], eliasOpinion: "fan", activity: "night-owl", germanRatio: 0.65,
      relationships: ["u_tarek", "u_ida", "u_leni", "u_jonas"],
    },
  },
  {
    id: "u_jonas", username: "jnsbrt", displayName: "Jonas", grad: ["#4f9cf9", "#1d3f8f"], roleId: "inner", presence: "online",
    statusText: "shipping, allegedly",
    profile: {
      age: 29, city: "Hamburg", district: "Barmbek",
      bio: "Frontend dev, coffee snob, Elias' most loyal critic. Will praise a launch and file three bug reports in the same breath.",
      traits: ["dry humour", "precise", "loyal critic"], quirks: ["English with German swear words", "starts with 'not to be that guy'"],
      topics: ["SPOTLY", "Next.js", "espresso", "UX nitpicks"], eliasOpinion: "rival-friend", activity: "always-on", germanRatio: 0.3,
      relationships: ["u_noor", "u_emil", "u_mara", "u_sofia"],
    },
  },
  {
    id: "u_leni", username: "lenivibes", displayName: "Leni", grad: ["#f6a6ff", "#8a4dff"], roleId: "regular", presence: "online",
    voice: { channelId: "c_vc_main" },
    profile: {
      age: 23, city: "Berlin", district: "Neukölln",
      bio: "Fashion student who treats every invite card like a museum piece. Knows who is fighting with whom before they do.",
      traits: ["gossip", "stylish", "loud"], quirks: ["CAPS when excited", "uses 'iconic' unironically"],
      topics: ["fashion", "invite cards", "gossip", "berlin vs hamburg"], eliasOpinion: "fan", activity: "evening", germanRatio: 0.55,
      relationships: ["u_pia", "u_mara", "u_jule"],
    },
  },
  {
    id: "u_tarek", username: "tarek.wav", displayName: "Tarek", grad: ["#22d3a6", "#0f5c68"], roleId: "inner", presence: "online",
    statusText: "set prep 🎧",
    voice: { channelId: "c_vc_main", speaking: true },
    profile: {
      age: 31, city: "Hamburg", district: "Altona",
      bio: "DJ and producer. Plays basements, not festivals, on purpose. Calm until someone requests a song.",
      traits: ["calm", "nocturnal", "music snob"], quirks: ["short messages", "never uses capitals", "time stamps everything ('ab 1')"],
      topics: ["sets", "vinyl", "club doors", "sound systems"], eliasOpinion: "chill", activity: "night-owl", germanRatio: 0.75,
      relationships: ["u_niko", "u_mara", "u_zara"],
    },
  },
  {
    id: "u_sofia", username: "sofiaa", displayName: "Sofia", grad: ["#ffd36e", "#ff8a3d"], roleId: "regular", presence: "idle",
    statusText: "kerning something",
    profile: {
      age: 27, city: "online", district: "Lisbon",
      bio: "Brand designer working remote from Lisbon. Joined for the typography, stayed for the drama.",
      traits: ["thoughtful", "picky", "kind"], quirks: ["English only", "uses em dashes"],
      topics: ["type", "empty states", "branding", "lisbon"], eliasOpinion: "skeptic-warm", activity: "evening", germanRatio: 0,
      relationships: ["u_jonas", "u_hanna"],
    },
  },
  {
    id: "u_kemal", username: "kemo", displayName: "Kemal", grad: ["#7bd389", "#2a7f62"], roleId: "regular", presence: "online",
    statusText: "ranked or nothing", statusEmoji: "🎮",
    profile: {
      age: 25, city: "Hamburg", district: "Wilhelmsburg",
      bio: "Gamer, meme archivist, professional hater of overpriced sneakers. Stays home and somehow knows everything that happened.",
      traits: ["deadpan", "loyal", "homebody"], quirks: ["💀 as punctuation", "one-word replies"],
      topics: ["games", "memes", "food prices", "franzbrötchen discourse"], eliasOpinion: "chill", activity: "always-on", germanRatio: 0.85,
      relationships: ["u_vincent", "u_finn", "u_paul"],
    },
  },
  {
    id: "u_ida", username: "ida.analog", displayName: "Ida", grad: ["#c9a27e", "#5b3a29"], roleId: "inner", presence: "online",
    statusText: "portra 400 only",
    profile: {
      age: 30, city: "Hamburg", district: "Ottensen",
      bio: "Film photographer. Elias' sharpest eye — loves his night work and will still tell you the highlights are clipped.",
      traits: ["honest", "technical", "warm underneath"], quirks: ["talks in exposure stops", "says 'notes' a lot"],
      topics: ["film stocks", "night photography", "darkroom", "composition"], eliasOpinion: "skeptic-warm", activity: "evening", germanRatio: 0.45,
      relationships: ["u_hanna", "u_mara", "u_oskar"],
    },
  },
  {
    id: "u_finn", username: "finnforreal", displayName: "Finn", grad: ["#5ee7ff", "#3b6cff"], roleId: "tourist", presence: "online",
    profile: {
      age: 22, city: "Hamburg", district: "moved from Kiel",
      bio: "First-year student, came in through a friend's invite and never left. Meme reflexes faster than his train.",
      traits: ["chaotic", "eager", "funny"], quirks: ["double exclamation marks", "typos when hyped"],
      topics: ["memes", "uni", "deutsche bahn", "being new in town"], eliasOpinion: "fan", activity: "evening", germanRatio: 0.8,
      relationships: ["u_kemal", "u_lukas", "u_leni"],
    },
  },
  {
    id: "u_noor", username: "noor.exe", displayName: "Noor", grad: ["#9aa5b1", "#3a4452"], roleId: "regular", presence: "dnd",
    statusText: "in a migration, do not ping",
    profile: {
      age: 28, city: "Berlin",
      bio: "Backend engineer. Short answers, correct answers. Secretly the most helpful person on the server.",
      traits: ["blunt", "helpful", "pragmatic"], quirks: ["English only", "answers in one line", "no emoji"],
      topics: ["databases", "infra", "IMAGEFORGE backend", "boring tech"], eliasOpinion: "skeptic-warm", activity: "always-on", germanRatio: 0.1,
      relationships: ["u_emil", "u_jonas", "u_jasper"],
    },
  },
  {
    id: "u_paul", username: "paulsen", displayName: "Paul", grad: ["#ffb199", "#ff0844"], roleId: "regular", presence: "idle",
    statusText: "mise en place",
    profile: {
      age: 33, city: "Hamburg", district: "Eimsbüttel",
      bio: "Line cook turned private chef. Posts at 7am, sleeps by 22:00, judges everyone's breakfast.",
      traits: ["grumpy-funny", "generous", "early riser"], quirks: ["starts with 'moin'", "recipe tangents"],
      topics: ["food", "markets", "fischbrötchen", "kitchen chaos"], eliasOpinion: "chill", activity: "morning-lurker", germanRatio: 0.9,
      relationships: ["u_nele", "u_kemal", "u_can"],
    },
  },
  {
    id: "u_yuki", username: "yuki_kt", displayName: "Yuki", grad: ["#ffc3e1", "#9a7bff"], roleId: "regular", presence: "online",
    statusText: "drawing pigeons",
    profile: {
      age: 24, city: "online", district: "Düsseldorf",
      bio: "Illustrator who turns server lore into doodles. Currently drawing everyone as pigeons.",
      traits: ["gentle", "whimsical", "observant"], quirks: ["English only", "parentheses asides"],
      topics: ["illustration", "anime", "server lore", "stationery"], eliasOpinion: "chill", activity: "evening", germanRatio: 0.05,
      relationships: ["u_leni", "u_rosa"],
    },
  },
  {
    id: "u_ben", username: "benni.b", displayName: "Ben", grad: ["#ff9a3c", "#b9411f"], roleId: "regular", presence: "online",
    profile: {
      age: 27, city: "Hamburg", district: "Hamm",
      bio: "Sales by day, gym by night. Supportive to a fault, reacts to everything with a flexed arm.",
      traits: ["supportive", "energetic", "simple joys"], quirks: ["💪 and 🔥", "short hype lines"],
      topics: ["gym", "football", "nights out", "elias' shots"], eliasOpinion: "fan", activity: "evening", germanRatio: 0.85,
      relationships: ["u_lukas", "u_mara"],
    },
  },
  {
    id: "u_clara", username: "clrx", displayName: "Clara", grad: ["#a1c4fd", "#5f72bd"], roleId: "inner", presence: "online",
    statusText: "making a list",
    profile: {
      age: 29, city: "Hamburg", district: "Winterhude",
      bio: "Product manager who plans every photo walk like a launch. Spreadsheets for picnics.",
      traits: ["organised", "dry", "reliable"], quirks: ["numbered lists", "'reminder:' openers"],
      topics: ["photo walks", "planning", "the learning app", "stadtpark"], eliasOpinion: "skeptic-warm", activity: "always-on", germanRatio: 0.7,
      relationships: ["u_emil", "u_mara", "u_ben"],
    },
  },
  {
    id: "u_malik", username: "malik.fm", displayName: "Malik", grad: ["#434343", "#bfa46f"], roleId: "regular", presence: "offline",
    profile: {
      age: 26, city: "Berlin", district: "Wedding",
      bio: "Hobby rapper with a day job in logistics. Respects Elias, competes with him on principle.",
      traits: ["competitive", "witty", "proud"], quirks: ["rhymes by accident", "'respekt' as a sign-off"],
      topics: ["rap", "berlin", "launch events", "competition"], eliasOpinion: "rival-friend", activity: "night-owl", germanRatio: 0.8,
      relationships: ["u_tarek", "u_daniel"],
    },
  },
  {
    id: "u_jule", username: "julez", displayName: "Jule", grad: ["#f9d423", "#ff4e50"], roleId: "tourist", presence: "online",
    statusText: "mercury retrograde survivor",
    profile: {
      age: 21, city: "Lüneburg",
      bio: "Uni student commuting to Hamburg on weekends. Astrology, memes, and very strong opinions about trains.",
      traits: ["bubbly", "dramatic", "sweet"], quirks: ["star signs for everyone", "😩 a lot"],
      topics: ["astrology", "trains", "memes", "weekend plans"], eliasOpinion: "fan", activity: "evening", germanRatio: 0.9,
      relationships: ["u_leni", "u_pia", "u_finn"],
    },
  },
  {
    id: "u_niko", username: "nikopolis", displayName: "Niko", grad: ["#355c7d", "#c06c84"], roleId: "inner", presence: "online",
    statusText: "behind the bar till 4",
    voice: { channelId: "c_vc_main" },
    profile: {
      age: 32, city: "Hamburg", district: "St. Georg",
      bio: "Bartender. Knows every late-night späti and every bouncer's birthday. The server's night oracle.",
      traits: ["street smart", "calm", "funny"], quirks: ["tips in every message", "'digga' sparingly"],
      topics: ["bars", "hamburg nights", "reeperbahn", "späti lore"], eliasOpinion: "chill", activity: "night-owl", germanRatio: 0.9,
      relationships: ["u_tarek", "u_amira", "u_mara"],
    },
  },
  {
    id: "u_hanna", username: "hanna.grain", displayName: "Hanna", grad: ["#e0c3fc", "#8ec5fc"], roleId: "regular", presence: "online",
    profile: {
      age: 25, city: "online", district: "Bremen",
      bio: "Photo editor, preset collector. Convinced Elias has a secret recipe and is determined to reverse-engineer it.",
      traits: ["curious", "fangirl", "detail-oriented"], quirks: ["English", "asks 'what settings??'"],
      topics: ["presets", "fujifilm recipes", "grain", "elias' photos"], eliasOpinion: "fan", activity: "evening", germanRatio: 0.2,
      relationships: ["u_ida", "u_sofia", "u_oskar"],
    },
  },
  {
    id: "u_emil", username: "emil.zip", displayName: "Emil", grad: ["#43e97b", "#38f9d7"], roleId: "regular", presence: "online",
    statusText: "learning rust (again)",
    profile: {
      age: 24, city: "Hamburg", district: "Uhlenhorst",
      bio: "Junior dev who joined for the build channel. Asks the questions everyone else is too proud to ask.",
      traits: ["curious", "earnest", "fast learner"], quirks: ["'kurze frage'", "German-English tech mix"],
      topics: ["IMAGEFORGE", "sqlite", "side projects", "learning"], eliasOpinion: "fan", activity: "always-on", germanRatio: 0.6,
      relationships: ["u_noor", "u_jonas", "u_clara"],
    },
  },
  {
    id: "u_zara", username: "zaraonline", displayName: "Zara", grad: ["#ee9ca7", "#ffdde1"], roleId: "regular", presence: "idle",
    statusText: "on deadline",
    profile: {
      age: 30, city: "online", district: "London",
      bio: "Music journalist. Treats the server like field research on European nightlife. Polite skeptic of hype.",
      traits: ["articulate", "skeptical", "curious"], quirks: ["English only", "'iconic' but sarcastic"],
      topics: ["music journalism", "nightlife", "london vs hamburg", "scenes"], eliasOpinion: "skeptic-warm", activity: "evening", germanRatio: 0,
      relationships: ["u_tarek", "u_mara"],
    },
  },
  {
    id: "u_lukas", username: "lux", displayName: "Lukas", grad: ["#1e3c72", "#2a5298"], roleId: "regular", presence: "online",
    statusText: "HSV till I die",
    profile: {
      age: 28, city: "Hamburg", district: "Stellingen",
      bio: "Season ticket holder, suffers accordingly. Every conversation ends up at the Volkspark.",
      traits: ["loyal", "self-deprecating", "sporty"], quirks: ["football metaphors", "✋ when shutting down a topic"],
      topics: ["HSV", "St. Pauli banter", "bike rides", "elbtunnel"], eliasOpinion: "chill", activity: "evening", germanRatio: 0.95,
      relationships: ["u_ben", "u_finn"],
    },
  },
  {
    id: "u_amira", username: "amira.k", displayName: "Amira", grad: ["#b06ab3", "#4568dc"], roleId: "regular", presence: "online",
    voice: { channelId: "c_vc_after" },
    profile: {
      age: 27, city: "Hamburg", district: "Eppendorf",
      bio: "Night-shift nurse. Reads the chat at 4am on break and replies to everything at once.",
      traits: ["warm", "tired", "sharp humour"], quirks: ["batch replies", "'komme grad aus der schicht'"],
      topics: ["night shifts", "sleep", "brunch", "being dragged out"], eliasOpinion: "chill", activity: "night-owl", germanRatio: 0.85,
      relationships: ["u_niko", "u_mara", "u_nele"],
    },
  },
  {
    id: "u_theo", username: "theodor", displayName: "Theo", grad: ["#757f9a", "#d7dde8"], roleId: "regular", presence: "offline",
    profile: {
      age: 34, city: "Hamburg", district: "Harvestehude",
      bio: "Architect, watch nerd, collector of vintage cameras he never uses. The server's resident 'well, actually'.",
      traits: ["well-read", "pedantic", "generous"], quirks: ["long sentences", "historical tangents"],
      topics: ["architecture", "vintage cameras", "watches", "speicherstadt"], eliasOpinion: "skeptic-warm", activity: "morning-lurker", germanRatio: 0.7,
      relationships: ["u_ida", "u_clara"],
    },
  },
  {
    id: "u_pia", username: "piapia", displayName: "Pia", grad: ["#ff6a88", "#ff99ac"], roleId: "tourist", presence: "online",
    statusText: "editing reels",
    profile: {
      age: 22, city: "Hamburg", district: "Eilbek",
      bio: "Content creator. Wants every night documented, ideally as a vlog, ideally yesterday.",
      traits: ["impatient", "fun", "trend-aware"], quirks: ["😭 and 😩", "CAPS for emphasis"],
      topics: ["reels", "vlogs", "trends", "elias' content"], eliasOpinion: "fan", activity: "evening", germanRatio: 0.85,
      relationships: ["u_leni", "u_jule"],
    },
  },
  {
    id: "u_daniel", username: "dnl", displayName: "Daniel", grad: ["#14f195", "#9945ff"], roleId: "regular", presence: "idle",
    statusText: "wagmi (ironically)",
    profile: {
      age: 31, city: "Berlin", district: "Friedrichshain",
      bio: "Ex-crypto bro, now ironic crypto bro. Suggests putting everything on a blockchain, mostly as a bit.",
      traits: ["trolly", "smart", "self-aware"], quirks: ["Solana jokes", "'war ein witz. halb.'"],
      topics: ["crypto jokes", "startups", "berlin rent", "hot takes"], eliasOpinion: "rival-friend", activity: "always-on", germanRatio: 0.7,
      relationships: ["u_noor", "u_malik", "u_vincent"],
    },
  },
  {
    id: "u_lea", username: "lea.lowkey", displayName: "Lea", grad: ["#cfd9df", "#6a85b6"], roleId: "regular", presence: "idle",
    voice: { channelId: "c_vc_afk", selfMute: true, selfDeaf: true },
    profile: {
      age: 26, city: "Hamburg", district: "Barmbek",
      bio: "Lurker supreme. Says 'morgen' every morning and reacts to everything else.",
      traits: ["quiet", "observant", "kind"], quirks: ["one-word messages", "reactions over replies"],
      topics: ["mornings", "books", "rain", "cats"], eliasOpinion: "chill", activity: "morning-lurker", germanRatio: 0.9,
      relationships: ["u_paul", "u_nele"],
    },
  },
  {
    id: "u_oskar", username: "oskr", displayName: "Oskar", grad: ["#f83600", "#f9d423"], roleId: "regular", presence: "online",
    voice: { channelId: "c_vc_main", selfMute: true },
    profile: {
      age: 29, city: "Hamburg", district: "Hafen-City-adjacent",
      bio: "Skater and videographer. Films fog over the cranes at 3am and calls it research.",
      traits: ["laid back", "visual", "spontaneous"], quirks: ["'sah aus wie blade runner'", "posts clips without context"],
      topics: ["video", "skating", "harbour fog", "night shoots"], eliasOpinion: "fan", activity: "night-owl", germanRatio: 0.75,
      relationships: ["u_ida", "u_hanna", "u_niko"],
    },
  },
  {
    id: "u_merve", username: "merve.m", displayName: "Merve", grad: ["#c471f5", "#fa71cd"], roleId: "regular", presence: "online",
    profile: {
      age: 28, city: "Hamburg", district: "Harburg",
      bio: "Law student with the sharpest timing on the server. Ends arguments with one line.",
      traits: ["sharp", "funny", "principled"], quirks: ["'können wir kurz festhalten'", "precise wording"],
      topics: ["weather complaints", "law school", "ethics of guest lists", "tea"], eliasOpinion: "skeptic-warm", activity: "evening", germanRatio: 0.85,
      relationships: ["u_clara", "u_daniel"],
    },
  },
  {
    id: "u_jasper", username: "jaspr", displayName: "Jasper", grad: ["#00c6fb", "#005bea"], roleId: "regular", presence: "online",
    statusText: "fixing collision bugs",
    profile: {
      age: 25, city: "online", district: "Amsterdam",
      bio: "Indie game dev. Hangs out in build-in-public, trades map-tile war stories with Jonas.",
      traits: ["nerdy", "friendly", "laconic"], quirks: ["English only", "'lol' as full reply"],
      topics: ["game dev", "maps", "shaders", "amsterdam bikes"], eliasOpinion: "chill", activity: "always-on", germanRatio: 0,
      relationships: ["u_jonas", "u_noor"],
    },
  },
  {
    id: "u_nele", username: "nele.sunday", displayName: "Nele", grad: ["#fddb92", "#d1fdff"], roleId: "regular", presence: "offline",
    profile: {
      age: 30, city: "Hamburg", district: "Rotherbaum",
      bio: "Runs the Sunday Alster run club. Morning person in a server of night owls; unbothered.",
      traits: ["sunny", "disciplined", "teasing"], quirks: ["'ihr nachtgestalten'", "unsolicited cooking advice"],
      topics: ["running", "alster", "breakfast", "sleep schedules"], eliasOpinion: "fan", activity: "morning-lurker", germanRatio: 0.9,
      relationships: ["u_paul", "u_lea", "u_amira"],
    },
  },
  {
    id: "u_vincent", username: "vin", displayName: "Vincent", grad: ["#000000", "#ff5f6d"], roleId: "regular", presence: "online",
    profile: {
      age: 27, city: "Hamburg", district: "Sternschanze",
      bio: "Sneaker reseller. Thinks the Lounge merch should drop in limited runs and has a spreadsheet to prove it.",
      traits: ["hustler", "funny", "competitive"], quirks: ["'das ist der PUNKT'", "price talk"],
      topics: ["sneakers", "drops", "merch", "resale"], eliasOpinion: "rival-friend", activity: "evening", germanRatio: 0.85,
      relationships: ["u_kemal", "u_daniel"],
    },
  },
  {
    id: "u_rosa", username: "rosa.rot", displayName: "Rosa", grad: ["#e96443", "#904e95"], roleId: "regular", presence: "offline",
    profile: {
      age: 24, city: "Leipzig",
      bio: "Art school, risograph prints, fog photos from Leipzig. Visits Hamburg for the harbour light.",
      traits: ["artsy", "soft-spoken", "wry"], quirks: ["'kein hamburg aber'", "lowercase"],
      topics: ["riso prints", "leipzig", "fog", "zines"], eliasOpinion: "chill", activity: "evening", germanRatio: 0.8,
      relationships: ["u_yuki", "u_ida"],
    },
  },
  {
    id: "u_can", username: "candid", displayName: "Can", grad: ["#f7971e", "#ffd200"], roleId: "regular", presence: "online",
    voice: { channelId: "c_vc_after" },
    profile: {
      age: 26, city: "Hamburg", district: "Barmbek-Süd",
      bio: "Runs a food truck with his cousin. Announces new spots like album drops.",
      traits: ["generous", "loud", "business brain"], quirks: ["free ayran promises", "spot announcements"],
      topics: ["food truck", "barmbek", "street food", "late snacks"], eliasOpinion: "chill", activity: "always-on", germanRatio: 0.9,
      relationships: ["u_paul", "u_kemal", "u_niko"],
    },
  },
];

function initialsOf(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

export const ELIAS: User = {
  id: OWNER_ID,
  username: "elias",
  displayName: "Elias",
  avatar: { from: "#1b1b1f", to: "#c9a227", initials: "E" },
  roleId: "owner",
  isNpc: false,
  isHuman: true,
  presence: "online",
  statusText: "building the door",
  statusEmoji: "🔑",
};

export const DOORMAN: User = {
  id: BOT_ID,
  username: "doorman",
  displayName: "Doorman",
  avatar: { from: "#7d8ee8", to: "#3b3f8f", initials: "D" },
  roleId: "bot",
  isNpc: false,
  isBot: true,
  presence: "online",
  statusText: "checking the list",
};

export const NPC_USERS: User[] = NPC_SEEDS.map((s) => ({
  id: s.id,
  username: s.username,
  displayName: s.displayName,
  avatar: { from: s.grad[0], to: s.grad[1], initials: initialsOf(s.displayName) },
  roleId: s.roleId,
  isNpc: true,
  presence: s.presence,
  statusText: s.statusText,
  statusEmoji: s.statusEmoji,
  voiceChannelId: s.voice?.channelId,
  speaking: s.voice?.speaking,
  selfMute: s.voice?.selfMute,
  selfDeaf: s.voice?.selfDeaf,
}));

export const NPC_PROFILES: NpcProfile[] = NPC_SEEDS.map((s) => {
  const personality = PERSONALITIES[s.id];
  if (!personality) throw new Error(`missing personality for ${s.id}`);
  return { userId: s.id, ...s.profile, personality };
});

export const ALL_USERS: User[] = [ELIAS, DOORMAN, ...NPC_USERS];
