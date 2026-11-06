import type { Attachment, Message, Reaction } from "@/lib/types";

/**
 * Phase 1 static backlog. Hand-written so the shell feels lived-in before the
 * simulator exists. Every line is unique (checked by `pnpm seed`).
 * No message is authored by Elias — NPCs talk *about* him, never *as* him.
 */

type When = { day: number; hm: string } | { ago: number };

interface SeedMsg {
  k: string;
  a: string; // author short id (without "u_")
  at: When;
  c: string; // original line (Hamburg DE/EN mix)
  en?: string; // English version when `c` is (partly) German
  re?: string; // key of replied message (same channel)
  r?: Array<[string, number, boolean?]>;
  img?: Array<Omit<Attachment, "id" | "kind">>;
  edited?: boolean;
}

const y = (hm: string): When => ({ day: -1, hm });
const d = (day: number, hm: string): When => ({ day, hm });
const m = (ago: number): When => ({ ago });

const photo = (filename: string, palette: [string, string, string], width = 1200, height = 800) => ({
  filename,
  palette,
  width,
  height,
});

export const SEED_MESSAGES: Record<string, SeedMsg[]> = {
  c_welcome: [
    {
      k: "w1", a: "doorman", at: d(-21, "18:00"),
      c: "**Welcome to GOD // THE LOUNGE.** Private floors, loud rooms.\n\n**1.** Be kind or be quiet. Roasts are fine, cruelty isn't.\n**2.** 18+ only. No exceptions, no 'almost'.\n**3.** No doxxing — no addresses, no plates, no faces of people who didn't say yes.\n**4.** No scams, no 'investment opportunities', no DMs asking for money.\n**5.** Photos you post must be yours or credited.\n**6.** What happens on the floors can be talked about. What happens in DMs stays there.",
      r: [["🔑", 31, true], ["🖤", 18]],
    },
    {
      k: "w2", a: "doorman", at: d(-21, "18:01"),
      c: "Say hi in #introductions. Plans for tonight live in #hamburg-night. If you're lost, ask in #general — someone is always awake.",
      r: [["👋", 12]],
    },
  ],

  c_intros: [
    { k: "i1", a: "finn", at: d(-6, "20:14"), c: "hi!! finn, 22, gerade von kiel nach hamburg gezogen. leni hat mich reingeholt. ich kenne niemanden aber ich hab memes", en: "hi!! finn, 22, just moved from kiel to hamburg. leni brought me in. i don't know anyone but i have memes", r: [["👋", 9], ["💀", 2]] },
    { k: "i2", a: "leni", at: d(-6, "20:15"), re: "i1", c: "er untertreibt, seine memes sind gefährlich gut", en: "he's underselling it, his memes are dangerously good" },
    { k: "i3", a: "jasper", at: d(-4, "11:02"), c: "jasper, amsterdam, i make small weird games. found this place through the build-in-public thread on IMAGEFORGE. hello", r: [["🎮", 5]] },
    { k: "i4", a: "rosa", at: d(-2, "16:40"), c: "rosa, leipzig, kunsthochschule. ich mache riso drucke und fotografiere nebel. ida meinte ich passe hier rein", en: "rosa, leipzig, art school. i make riso prints and photograph fog. ida said i'd fit in here", r: [["🌫️", 6], ["🖤", 3]] },
    { k: "i5", a: "ida", at: d(-2, "16:52"), re: "i4", c: "sie passt hier rein. ihre nebel-serie ist besser als meine, und das sage ich nicht oft", en: "she fits in here. her fog series is better than mine, and i don't say that often" },
    { k: "i6", a: "jule", at: y("19:20"), c: "jule, 21, lüneburg 🙋‍♀️ bin wochenend-hamburgerin und zwilling (sorry vorab)", en: "jule, 21, lüneburg 🙋‍♀️ weekend hamburger and a gemini (sorry in advance)", r: [["♊", 4], ["😭", 2]] },
  ],

  c_general: [
    { k: "g1", a: "niko", at: y("21:58"), c: "wer ist heute noch draußen? regen hört angeblich um 23 uhr auf", en: "who's still going out tonight? rain is supposedly stopping at 11" },
    { k: "g2", a: "mara", at: y("22:01"), c: "angeblich 😭😭 die wetter app lügt seit 2019", en: "supposedly 😭😭 the weather app has been lying since 2019" },
    { k: "g3", a: "tarek", at: y("22:03"), re: "g1", c: "ich spiel ab 1 im keller an der reeperbahn. gästeliste hat noch 3 plätze", en: "i'm playing the basement on the reeperbahn from 1. guest list still has 3 spots", r: [["🎧", 6], ["🔥", 4]] },
    { k: "g4", a: "leni", at: y("22:04"), c: "PLATZ 1 BITTE", en: "SPOT 1 PLEASE" },
    { k: "g5", a: "finn", at: y("22:04"), c: "platz 2!! bitte bitte", en: "spot 2!! please please" },
    { k: "g6", a: "kemal", at: y("22:06"), c: "ich bleib zuhause und farm. viel spaß ihr nachtgestalten", en: "staying home and grinding. have fun, you night creatures" },
    { k: "g7", a: "jonas", at: y("22:10"), c: "has anyone seen elias' new lounge door shot? the red neon in the puddle one", r: [["😮", 5]] },
    { k: "g8", a: "ida", at: y("22:12"), re: "g7", c: "seen it. highlights are clipped on the left but honestly the mood carries it" },
    { k: "g9", a: "mara", at: y("22:12"), c: "ida bitte. lass den mann leben 😭", en: "ida please. let the man live 😭😭" },
    { k: "g10", a: "ida", at: y("22:13"), c: "i'm allowed to love it AND have notes", r: [["📝", 7], ["💯", 3]] },
    { k: "g11", a: "clara", at: y("22:20"), c: "reminder: morgen 19:00 photo walk. route steht:\n1. Barmbek Bahnhof\n2. Kampnagel\n3. Stadtpark bis es dunkel ist", en: "reminder: photo walk tomorrow at 19:00. route is set:\n1. Barmbek station\n2. Kampnagel\n3. Stadtpark until it gets dark", r: [["✅", 8]] },
    { k: "g12", a: "ben", at: y("22:21"), re: "g11", c: "bin dabei 💪", en: "i'm in 💪" },
    { k: "g13", a: "tarek", at: y("23:47"), c: "set ist vorbei. ich rieche nach nebelmaschine", en: "set's over. i smell like fog machine" },
    { k: "g14", a: "niko", at: y("23:52"), re: "g13", c: "die letzte stunde war unfassbar, du hast den raum komplett gekippt", en: "that last hour was unreal, you completely flipped the room", r: [["🖤", 6]] },

    { k: "g15", a: "lea", at: m(232), c: "morgen", en: "morning" },
    { k: "g16", a: "paul", at: m(230), c: "moin. hat jemand ein shakshuka rezept bei dem die küche danach nicht aussieht wie ein tatort", en: "moin. anyone got a shakshuka recipe that doesn't leave the kitchen looking like a crime scene" },
    { k: "g17", a: "nele", at: m(224), re: "g16", c: "gusseiserne pfanne und geduld. mehr brauchst du nicht", en: "cast iron pan and patience. that's all you need" },
    { k: "g18", a: "paul", at: m(222), c: "geduld hab ich nicht, pfanne schon. 50% ist auch eine note", en: "no patience, but i do have the pan. 50% is still a passing grade", r: [["😂", 4]] },
    { k: "g19", a: "emil", at: m(160), c: "kurze frage: hat jemand sqlite in production? elias meinte im build channel das reicht für den start", en: "quick question: anyone running sqlite in production? elias said in the build channel it's enough to start with" },
    { k: "g20", a: "noor", at: m(157), re: "g19", c: "for a single box app? totally fine. WAL mode, nightly backups, done. people overthink this", r: [["🧠", 5]] },
    { k: "g21", a: "jonas", at: m(155), c: "noor dropping facts with zero emoji as usual" },
    { k: "g22", a: "noor", at: m(154), re: "g21", c: "someone has to" },
    { k: "g23", a: "vincent", at: m(121), c: "yo wer hat die neuen sambas in schwarz gesehen, die preise sind komplett gestört", en: "yo who's seen the new black sambas, the prices are completely unhinged" },
    { k: "g24", a: "kemal", at: m(119), re: "g23", c: "120€ für schuhe die aussehen wie hallensport 2004 💀", en: "120€ for shoes that look like PE class in 2004 💀" },
    { k: "g25", a: "vincent", at: m(118), c: "das ist der PUNKT kemal", en: "that's the POINT kemal" },
    { k: "g26", a: "pia", at: m(84), c: "ok aber wann postet elias endlich den vlog vom letzten freitag, ich warte seit 6 tagen 😩", en: "ok but when is elias finally posting the vlog from last friday, i've been waiting 6 days 😩" },
    { k: "g27", a: "leni", at: m(82), re: "g26", c: "er hat in #photo-dump schon 3 stills gepostet, das ist praktisch ein vlog", en: "he already posted 3 stills in #photo-dump, that's basically a vlog" },
    { k: "g28", a: "pia", at: m(81), c: "STILLS sind kein VLOG leni", en: "STILLS are not a VLOG leni", r: [["😭", 6]] },
    { k: "g29", a: "merve", at: m(58), c: "können wir kurz festhalten dass es 14 grad und sonnig ist und keiner von euch draußen ist", en: "can we just note that it's 14 degrees and sunny and none of you are outside" },
    { k: "g30", a: "lukas", at: m(56), re: "g29", c: "ich bin draußen. am volkspark. leider", en: "i'm outside. at the volkspark. unfortunately" },
    { k: "g31", a: "finn", at: m(55), c: "lukas wir müssen über deine lebensentscheidungen reden", en: "lukas we need to talk about your life choices" },
    { k: "g32", a: "lukas", at: m(54), re: "g31", c: "nein müssen wir nicht ✋", en: "no we don't ✋", r: [["✋", 3], ["⚽", 2]] },
    { k: "g33", a: "mara", at: m(24), c: "ok wer ist dabei: elbstrand sunset heute, ich bring den kleinen lautsprecher 🔊", en: "ok who's in: elbstrand sunset today, i'll bring the little speaker 🔊", r: [["🌅", 9, true], ["🙋", 5]] },
    { k: "g34", a: "tarek", at: m(23), re: "g33", c: "dabei. ich bring kabel, nicht dass es wieder bluetooth-chaos gibt", en: "in. i'll bring cables so we don't get bluetooth chaos again" },
    { k: "g35", a: "ida", at: m(22), c: "mit kamera. diesmal nur 400er film, keine diskussion", en: "bringing the camera. only 400 film this time, no discussion" },
    { k: "g36", a: "jonas", at: m(19), c: "@Elias kommst du? sonst bestimmt mara wieder die komplette playlist", en: "@Elias you coming? otherwise mara picks the whole playlist again", r: [["👀", 7]] },
    { k: "g37", a: "mara", at: m(18), re: "g36", c: "und das wäre schlimm weil???", en: "and that would be bad because???" },
    { k: "g38", a: "ben", at: m(9), c: "🌅🔥" },
    { k: "g39", a: "yuki", at: m(5), c: "i'll be there in spirit (and in the group chat photos)" },
    { k: "g40", a: "clara", at: m(2), c: "ok ich mach eine liste. wer bringt decken? wer bringt den kocher?", en: "ok i'm making a list. who's bringing blankets? who's bringing the camp stove?", r: [["🧺", 2]] },
  ],

  c_glaze: [
    { k: "z1", a: "hanna", at: y("20:31"), c: "the X100F night shot from the Lounge door drop… the grain on the wet asphalt is ridiculous", r: [["✨", 14], ["📸", 6]] },
    { k: "z2", a: "ida", at: y("20:35"), re: "z1", c: "it's the shadows for me. he didn't lift them. everyone lifts them" },
    { k: "z3", a: "ben", at: y("20:40"), c: "elias hat einfach ein auge für sowas. ich seh nebel, er macht ein poster draus", en: "elias just has an eye for this stuff. i see fog, he turns it into a poster" },
    { k: "z4", a: "sofia", at: y("21:02"), c: "can we talk about the typography on the invite cards — clean, no gimmicks, the spacing actually breathes", r: [["🖤", 9]] },
    { k: "z5", a: "leni", at: y("21:03"), re: "z4", c: "the silver foil ones?? meins hängt immer noch am spiegel", en: "the silver foil ones?? mine's still on my mirror" },
    { k: "z6", a: "jonas", at: m(150), c: "not to be that guy but the SPOTLY onboarding is still 4 screens too long" },
    { k: "z7", a: "emil", at: m(148), re: "z6", c: "jonas schafft es sogar in #glaze kritik unterzubringen 😭", en: "only jonas could sneak criticism into #glaze 😭" },
    { k: "z8", a: "jonas", at: m(147), c: "it's called balance", r: [["⚖️", 5], ["💀", 3]] },
    { k: "z9", a: "pia", at: m(70), c: "das reel mit dem treppenhaus-licht hat bei mir allein durch reposts 40k views 😭", en: "the stairwell-light reel got 40k views on my account just from reposts 😭" },
    { k: "z10", a: "malik", at: m(66), c: "respekt wo respekt hingehört: der lounge launch war sauber organisiert. kein chaos an der tür, kein warten", en: "respect where it's due: the lounge launch was run cleanly. no chaos at the door, no waiting" },
    { k: "z11", a: "hanna", at: m(31), c: "drop the recipe challenge. i bet it's mostly in-camera" },
    { k: "z12", a: "mara", at: m(29), re: "z11", c: "it IS in camera. classic chrome, highlights -1, grain weak. hab ihn gefragt", en: "it IS in camera. classic chrome, highlights -1, grain weak. i asked him", r: [["🙏", 8, true]] },
  ],

  c_hhnight: [
    { k: "h1", a: "niko", at: m(205), c: "reeperbahn ist heute komplett dicht, alles voller junggesellenabschiede 💀", en: "reeperbahn is completely packed tonight, wall-to-wall bachelor parties 💀" },
    { k: "h2", a: "tarek", at: m(203), re: "h1", c: "deshalb geht man ja auch in die seitenstraßen", en: "that's why you go to the side streets" },
    { k: "h3", a: "amira", at: m(170), c: "komme grad aus der nachtschicht und ihr redet schon wieder über clubs. ich bin so neidisch", en: "just got off night shift and you're talking about clubs again. so jealous" },
    { k: "h4", a: "mara", at: m(168), re: "h3", c: "amira nächstes wochenende wirst du entführt. keine widerrede", en: "amira you're getting kidnapped next weekend. no arguments", r: [["🫡", 4]] },
    { k: "h5", a: "oskar", at: m(140), c: "wer war gestern am hafen? hab den nebel über den kränen gefilmt, sah aus wie blade runner", en: "who was at the harbour last night? filmed the fog over the cranes, looked like blade runner" },
    { k: "h6", a: "ida", at: m(138), re: "h5", c: "das licht da um 2 uhr ist unfair gut", en: "the light there at 2am is unfairly good" },
    { k: "h7", a: "niko", at: m(120), c: "pro tip: der späti an der ecke hat wieder mate in glasflaschen. ihr wisst welcher", en: "pro tip: the späti on the corner has mate in glass bottles again. you know which one" },
    { k: "h8", a: "zara", at: m(96), c: "visiting hamburg in december — what's the one night out i shouldn't miss?" },
    { k: "h9", a: "tarek", at: m(94), re: "h8", c: "come on a thursday. smaller crowd, better music, nobody performing for their phone" },
    { k: "h10", a: "mara", at: m(93), c: "and ask elias. the man basically has a map of every door worth knocking on", r: [["🚪", 6]] },
    { k: "h11", a: "zara", at: m(92), c: "noted. a man with a door map. iconic" },
    { k: "h12", a: "lukas", at: m(41), c: "elbtunnel um 3 uhr nachts mit dem fahrrad ist übrigens eine erfahrung", en: "biking through the elbtunnel at 3am is an experience btw" },
    { k: "h13", a: "niko", at: m(40), re: "h12", c: "die erfahrung heißt kalte hände", en: "the experience is called cold hands", r: [["🥶", 3]] },
    { k: "h14", a: "amira", at: m(12), c: "@Elias bist du heute im keller? ich hab ausnahmsweise frei", en: "@Elias you in the basement tonight? i'm off for once" },
  ],

  c_photo: [
    {
      k: "p1", a: "ida", at: y("19:10"), c: "portra 400, push 1. hafen um 2", en: "portra 400, push 1. harbour at 2am",
      img: [photo("hafen_0217.jpg", ["#0b1a2b", "#c96b2c", "#f2c08a"])], r: [["🔥", 11], ["🎞️", 4]],
    },
    {
      k: "p2", a: "oskar", at: y("23:58"), c: "nebel gestern, ungeschnitten", en: "fog last night, uncut",
      img: [photo("crane_fog_01.jpg", ["#1b2430", "#5d6b7a", "#cfd7df"], 900, 1200), photo("crane_fog_02.jpg", ["#101418", "#3a4c5e", "#9fb2c4"], 900, 1200)],
    },
    { k: "p3", a: "hanna", at: m(140), re: "p2", c: "the second one!! the way the light sits in the fog" },
    { k: "p4", a: "mara", at: m(100), c: "elias' still vom elbstrand hat mich gerade wieder umgehauen. why is everything he shoots so cinematic", en: "elias' still from the elbstrand just floored me again. why is everything he shoots so cinematic", r: [["🌅", 7]] },
    {
      k: "p5", a: "rosa", at: m(60), c: "kein hamburg aber leipzig hat auch nebel", en: "not hamburg but leipzig has fog too",
      img: [photo("leipzig_nebel.jpg", ["#20222a", "#6f6a78", "#d9d2cf"], 1200, 900)], r: [["🌫️", 5]],
    },
    { k: "p6", a: "theo", at: m(15), re: "p5", c: "Schöne Tonwerte. Die Laterne links hätte ich nicht beschnitten, aber das ist Geschmackssache.", en: "Lovely tonal range. I wouldn't have cropped the lamp on the left, but that's a matter of taste." },
  ],

  c_build: [
    { k: "b1", a: "emil", at: y("18:12"), c: "IMAGEFORGE beta, kurze frage: does the batch export keep EXIF? asking for the photo dump people", en: "IMAGEFORGE beta, quick question: does the batch export keep EXIF? asking for the photo dump people" },
    { k: "b2", a: "noor", at: y("18:15"), re: "b1", c: "strips GPS, keeps camera + lens. good call honestly", r: [["🔒", 6]] },
    { k: "b3", a: "jonas", at: y("21:40"), c: "SPOTLY v0.4 changelog looks clean. map clustering finally doesn't jitter when you zoom", r: [["🗺️", 5]] },
    { k: "b4", a: "jasper", at: y("21:44"), c: "how are you doing the map tiles, self-hosted or provider?" },
    { k: "b5", a: "jonas", at: y("21:46"), re: "b4", c: "provider for now. self-hosting tiles is a lifestyle, not a decision", r: [["😂", 7]] },
    { k: "b6", a: "clara", at: m(190), c: "der lern-app prototyp ist echt gut, aber die streak logik bestraft dich zu hart wenn du einen tag krank bist", en: "the learning app prototype is really good, but the streak logic punishes you too hard if you're sick for a day" },
    { k: "b7", a: "emil", at: m(188), re: "b6", c: "streak freeze!!" },
    { k: "b8", a: "noor", at: m(186), c: "streak freeze is the most profitable feature in the history of apps. just saying" },
    { k: "b9", a: "sofia", at: m(130), c: "happy to do a pass on the empty states if anyone wants — right now they're a bit… empty", r: [["🙌", 4]] },
    { k: "b10", a: "jasper", at: m(129), re: "b9", c: "lol" },
    { k: "b11", a: "daniel", at: m(45), c: "ihr solltet IMAGEFORGE auf solana launchen", en: "you should launch IMAGEFORGE on solana" },
    { k: "b12", a: "noor", at: m(44), re: "b11", c: "no" },
    { k: "b13", a: "daniel", at: m(43), c: "war ein witz. halb.", en: "it was a joke. half.", r: [["🙄", 5]] },
  ],

  c_random: [
    { k: "r1", a: "kemal", at: y("16:20"), c: "unpopular opinion: franzbrötchen sind überbewertet", en: "unpopular opinion: franzbrötchen are overrated" },
    { k: "r2", a: "paul", at: y("16:22"), re: "r1", c: "kemal raus", en: "kemal out", r: [["🚪", 9]] },
    { k: "r3", a: "jule", at: m(210), c: "hab gerade 20 minuten auf einen zug gewartet der dann einfach nicht kam. kein grund. einfach nicht 😩", en: "just waited 20 minutes for a train that then simply didn't come. no reason. it just didn't 😩" },
    { k: "r4", a: "yuki", at: m(150), c: "currently drawing everyone in this server as pigeons. no further questions" },
    { k: "r5", a: "leni", at: m(149), re: "r4", c: "ich will die elegante taube sein", en: "i want to be the elegant pigeon" },
    { k: "r6", a: "yuki", at: m(148), c: "you're the one with the tiny scarf (obviously)", r: [["🧣", 6], ["🐦", 4]] },
    { k: "r7", a: "can", at: m(75), c: "neuer food truck spot ab montag: vor der hochschule in barmbek. die ersten 10 kriegen ein gratis ayran", en: "new food truck spot from monday: outside the university in barmbek. first 10 get a free ayran", r: [["🥙", 8]] },
    { k: "r8", a: "kemal", at: m(73), re: "r7", c: "ich bin nummer 1. ich schlafe da", en: "i'm number 1. i'll sleep there" },
  ],

  c_memes: [
    { k: "x1", a: "finn", at: y("23:10"), c: "elias: 'nur ein kurzes foto'\n\n47 minuten später: 'ok noch eins mit anderem licht'", en: "elias: 'just one quick photo'\n\n47 minutes later: 'ok one more with different light'", r: [["💀", 17], ["📸", 5]] },
    { k: "x2", a: "kemal", at: y("23:11"), c: "💀💀" },
    { k: "x3", a: "vincent", at: m(110), c: "me explaining to my mom that the lounge is not a cult, it's a community with a dress code", r: [["😭", 12]] },
    { k: "x4", a: "merve", at: m(108), re: "x3", c: "ein kult mit gästeliste ist immer noch ein kult", en: "a cult with a guest list is still a cult" },
    { k: "x5", a: "daniel", at: m(30), c: "POV: du sagst 'ich geh nur kurz auf ein getränk' im hamburg-night channel", en: "POV: you say 'just going out for one drink' in the hamburg-night channel", r: [["🫠", 6]] },
  ],

  c_ops: [
    { k: "o1", a: "doorman", at: m(240), c: "Simulation online · stub brain · 32 NPCs loaded · density: **busy**" },
    { k: "o2", a: "doorman", at: m(239), c: "Phase 1 shell: controls (pause, density, force topic, burst, mute) arrive with the simulator in Phase 3." },
  ],

  c_npcdebug: [
    { k: "n1", a: "doorman", at: m(238), c: "`uniqueness` window=200/channel · rejects today: 0 · near-dupe threshold: 0.82" },
  ],

  c_lab_roadmap: [
    { k: "l1", a: "clara", at: d(-3, "10:00"), c: "@Elias Q4 order: SPOTLY offline maps → IMAGEFORGE batch presets → learning app streak freeze" },
    { k: "l2", a: "jonas", at: d(-3, "10:12"), re: "l1", c: "@Elias offline maps first is the right call, the rest can wait" },
  ],
  c_lab_feedback: [],
  c_dark_main: [
    { k: "dk1", a: "ida", at: d(-1, "09:30"), c: "dev times for ilford hp5 @1600 in ddx anyone?" },
  ],
};

export interface BuiltBacklog {
  messages: Message[];
}

function minutesSinceMidnight(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Converts the relative seed timestamps into absolute ones around `nowMs`. */
export function buildBacklog(nowMs: number, userIdFor: (short: string) => string): Message[] {
  const now = new Date(nowMs);
  const sinceMidnight = minutesSinceMidnight(now);
  let maxAgo = 1;
  for (const list of Object.values(SEED_MESSAGES)) {
    for (const s of list) if ("ago" in s.at) maxAgo = Math.max(maxAgo, s.at.ago);
  }
  // Keep "today" messages on today even just after midnight: squash offsets.
  const scale = Math.min(1, Math.max(0.01, (sinceMidnight - 1) / maxAgo));

  const out: Message[] = [];
  for (const [channelId, list] of Object.entries(SEED_MESSAGES)) {
    const keyToId = new Map<string, string>();
    list.forEach((s, i) => keyToId.set(s.k, `m_${channelId}_${i.toString().padStart(3, "0")}`));
    for (const s of list) {
      let createdAt: number;
      if ("ago" in s.at) {
        createdAt = nowMs - Math.round(s.at.ago * scale * 60_000);
      } else {
        const [hh, mm] = s.at.hm.split(":").map(Number) as [number, number];
        const day = new Date(now);
        day.setDate(day.getDate() + s.at.day);
        day.setHours(hh, mm, 0, 0);
        createdAt = day.getTime();
      }
      const reactions: Reaction[] | undefined = s.r?.map(([emoji, count, me]) => ({ emoji, count, me: !!me }));
      const id = keyToId.get(s.k)!;
      out.push({
        id,
        channelId,
        authorId: userIdFor(s.a),
        content: s.c,
        i18n: s.en ? { en: s.en, de: s.c } : undefined,
        createdAt,
        replyToId: s.re ? keyToId.get(s.re) : undefined,
        reactions,
        attachments: s.img?.map((img, i) => ({ id: `${id}_a${i}`, kind: "image" as const, ...img })),
      });
    }
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}

/** Fake "who is typing" per channel for the static shell. */
export const SEED_TYPING: Record<string, string[]> = {
  c_general: ["u_mara", "u_tarek", "u_finn"],
  c_hhnight: ["u_niko"],
  c_glaze: ["u_hanna", "u_leni"],
};

/** Read state for the static shell (unread dot, bold, mention badges). */
export const SEED_READ_STATE: Record<string, { unread: boolean; mentions: number }> = {
  c_hhnight: { unread: true, mentions: 1 },
  c_glaze: { unread: true, mentions: 0 },
  c_photo: { unread: true, mentions: 0 },
  c_memes: { unread: true, mentions: 0 },
  c_lab_roadmap: { unread: true, mentions: 2 },
};
