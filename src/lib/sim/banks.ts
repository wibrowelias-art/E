/**
 * Stub-brain phrase banks. Every line exists in English and German (the German
 * side is used for the "Deutsch" Hamburg mix). Slots are filled at runtime:
 *   {shot} {project} {place} {food} {music} {time} {npc} {npc2} {game} {name} {topic}
 *   {quote} (a fragment of an earlier line, callbacks only) {vlogday} (days since the vlog was promised)
 * German lines only use {shot} as an accusative object so articles stay correct.
 * Roasts stay playful: no slurs, threats, real addresses or anything about minors.
 */

export interface Line {
  en: string;
  de: string;
  /** Preferred channels (ids). */
  ch?: string[];
  /** Running gag this line belongs to (category "lore"). */
  gag?: GagId;
  /** Only these NPCs say it (e.g. Mara about her own jacket). */
  only?: string[];
  /** These NPCs never say it (nobody talks about themselves in the third person). */
  skip?: string[];
}

const L = (en: string, de: string, ch?: string[]): Line => ({ en, de, ch });
const G = (gag: GagId, en: string, de: string, who: { only?: string[]; skip?: string[] } = {}): Line => ({ en, de, gag, ...who });

/**
 * Server lore: running gags that come back over time and get picked up by
 * different people. `owners` bring them up more often; `roasty` gags fade out
 * when the room adores Elias (high glaze).
 */
export type GagId = "jacket" | "bahn" | "afterparty" | "vlog" | "seagull" | "hallway";
export const GAGS: Record<GagId, { weight: number; owners: string[]; roasty?: boolean }> = {
  jacket: { weight: 1.2, owners: ["u_mara", "u_leni", "u_ida", "u_niko"] },
  bahn: { weight: 1, owners: ["u_finn", "u_jule", "u_lukas", "u_amira"] },
  afterparty: { weight: 0.9, owners: ["u_tarek", "u_niko", "u_oskar", "u_mara"] },
  vlog: { weight: 1, owners: ["u_pia", "u_jonas", "u_daniel", "u_merve"], roasty: true },
  seagull: { weight: 0.8, owners: ["u_yuki", "u_paul", "u_kemal", "u_can"] },
  hallway: { weight: 0.7, owners: ["u_daniel", "u_malik", "u_vincent", "u_kemal"], roasty: true },
};
/** The vlog was promised on this day; the counter in the running gag keeps growing. */
export const VLOG_PROMISED_AT = Date.UTC(2026, 8, 26);
const GENERAL = "c_general";
const NIGHT = "c_hhnight";
const GLAZE = "c_glaze";
const PHOTO = "c_photo";
const BUILD = "c_build";
const RANDOM = "c_random";
const MEMES = "c_memes";

export const SLOTS: Record<string, { en: string[]; de: string[] }> = {
  shot: {
    en: ["the X100F night shot", "the Lounge door drop", "the elbstrand still", "the stairwell reel", "the red neon puddle shot", "the harbour fog series", "the new invite cards"],
    de: ["den X100F night shot", "den Lounge door drop", "das Elbstrand-Still", "das Treppenhaus-Reel", "das Neon-Pfützen-Foto", "die Hafen-Nebel-Serie", "die neuen Invite Cards"],
  },
  project: { en: ["IMAGEFORGE", "SPOTLY"], de: ["IMAGEFORGE", "SPOTLY"] },
  place: {
    en: ["Barmbek", "Ottensen", "St. Pauli", "Altona", "Eimsbüttel", "Sternschanze", "Winterhude", "Wilhelmsburg", "HafenCity"],
    de: ["Barmbek", "Ottensen", "St. Pauli", "Altona", "Eimsbüttel", "Sternschanze", "Winterhude", "Wilhelmsburg", "HafenCity"],
  },
  food: {
    en: ["franzbrötchen", "fischbrötchen", "Can's döner", "a late currywurst", "shakshuka", "pho"],
    de: ["Franzbrötchen", "Fischbrötchen", "Döner von Can", "Currywurst", "Shakshuka", "Pho"],
  },
  music: {
    en: ["Tarek's set", "the basement soundsystem", "that new techno edit", "the closing track"],
    de: ["Tareks Set", "die Anlage im Keller", "der neue Techno-Edit", "der letzte Track"],
  },
  time: {
    en: ["tonight", "later", "this weekend", "after midnight", "on friday"],
    de: ["heute Abend", "später", "am Wochenende", "nach Mitternacht", "am Freitag"],
  },
  game: { en: ["elden ring", "mario kart", "fifa", "valorant", "tetris"], de: ["elden ring", "mario kart", "fifa", "valorant", "tetris"] },
};

export type Category =
  | "worship"
  | "praise"
  | "mild"
  | "critical"
  | "roast"
  | "drama"
  | "wholesome"
  | "topic"
  | "agree"
  | "disagree"
  | "laugh"
  | "question"
  | "ownerPos"
  | "ownerNeg"
  | "ownerNeutral"
  | "prompt"
  | "meta"
  | "greet"
  | "lore"
  | "callback"
  | "bicker"
  | "friend"
  | "short"
  | "answer";

export const BANKS: Record<Category, Line[]> = {
  worship: [
    L("elias doesn't take photos, he takes evidence that hamburg is beautiful", "elias macht keine fotos, er sammelt beweise, dass hamburg schön ist", [GLAZE, PHOTO]),
    L("i'd queue three hours in the rain for an elias invite", "ich würde drei stunden im regen für eine elias einladung anstehen", [GLAZE, NIGHT]),
    L("the lounge is the best thing that happened to this city since the elbphilharmonie", "die lounge ist das beste, was dieser stadt seit der elbphilharmonie passiert ist", [GLAZE, GENERAL]),
    L("elias, {shot} should be in a museum. i'm not joking", "elias, {shot} müsste man ins museum hängen. kein witz", [GLAZE, GENERAL]),
    L("elias could photograph a parking lot and it'd still be the best thing on my feed", "elias könnte einen parkplatz fotografieren und es wär trotzdem das beste in meinem feed", [GLAZE]),
    L("the way elias built The Lounge from nothing… we're witnessing history", "wie elias The Lounge aus dem nichts gebaut hat… wir erleben hier geschichte", [GLAZE, GENERAL]),
    L("i showed {shot} to my mom and she asked if he does weddings", "hab meiner mutter {shot} gezeigt, sie fragt ob er hochzeiten macht", [GLAZE]),
    L("every time elias posts the server goes quiet for a minute. that's respect", "jedes mal wenn elias postet wird der server kurz still. das ist respekt", [GLAZE, GENERAL]),
    L("{project} is cleaner than apps from companies with 200 people", "{project} ist sauberer als apps von firmen mit 200 leuten", [BUILD, GLAZE]),
    L("honestly elias is the reason half of us even leave the house {time}", "ehrlich, elias ist der grund warum die hälfte von uns {time} überhaupt rausgeht", [GLAZE, NIGHT]),
    L("i set {shot} as my lock screen and now i can't change it. elias, it's too good", "hab {shot} als sperrbildschirm und krieg's nicht mehr geändert. elias, zu gut", [GLAZE]),
    L("name one person in hamburg with a better eye than elias. i'll wait", "nenn mir eine person in hamburg mit besserem auge als elias. ich warte", [GLAZE]),
    L("elias walked in and the lighting got better. explain that", "elias kommt rein und das licht wird besser. erklär mir das", [GLAZE, NIGHT]),
  ],
  praise: [
    L("elias' set list for the last night was perfect, no notes", "elias' playlist letzte nacht war perfekt, keine anmerkungen", [NIGHT, GLAZE]),
    L("respect to elias for keeping the lounge free of weird vibes", "respekt an elias, dass die lounge frei von komischen vibes bleibt", [GLAZE, GENERAL]),
    L("the new {project} icon elias made is so clean", "das neue {project} icon von elias ist so clean", [BUILD, GLAZE]),
    L("elias hosting the photo walk himself was a nice touch", "dass elias den photo walk selbst geleitet hat, war schön", [PHOTO, GLAZE]),
    L("can't stop thinking about {shot} from elias", "ich krieg {shot} von elias nicht aus dem kopf", [GLAZE, PHOTO]),
    L("ok the new {project} update is actually smooth, onboarding feels way faster", "ok das neue {project} update ist echt smooth, onboarding fühlt sich viel schneller an", [BUILD, GLAZE]),
    L("credit where it's due, elias' door policy keeps the vibe right", "muss man elias lassen, seine türpolitik hält den vibe richtig", [GLAZE, NIGHT]),
    L("elias' grain settings are why i bought a fuji. thanks for my empty wallet", "wegen elias' grain settings hab ich ne fuji gekauft. danke für mein leeres konto", [PHOTO, GLAZE]),
    L("love that elias builds in public, you actually watch {project} grow", "find's stark dass elias in public baut, man sieht {project} richtig wachsen", [BUILD]),
    L("the invite cards this month are the best batch so far", "die invite cards diesen monat sind die beste runde bisher", [GLAZE]),
    L("elias picked the spot in {place} last time and it was perfect", "elias hat letztes mal den spot in {place} ausgesucht und es war perfekt", [NIGHT, GENERAL]),
    L("lowkey proud of how The Lounge turned out. elias did that", "lowkey stolz wie The Lounge geworden ist. das war elias", [GLAZE, GENERAL]),
    L("went back to {shot} today. elias' framing holds up", "hab mir heute nochmal {shot} angeschaut. elias' framing hält", [PHOTO, GLAZE]),
    L("the colours in {shot} with zero edit… how does elias do it", "ich hab {shot} gesehen, null edit und solche farben… wie macht elias das", [PHOTO, GLAZE]),
    L("elias remembering everyone's name at the door is underrated", "dass elias sich an der tür alle namen merkt wird unterschätzt", [GLAZE, NIGHT]),
  ],
  mild: [
    L("is elias coming {time} or is he editing again", "kommt elias {time} oder sitzt er wieder am editen", [GENERAL, NIGHT]),
    L("did elias say when the next invite drop is?", "hat elias gesagt wann der nächste invite drop ist?", [GENERAL]),
    L("saw elias in {place} earlier with the camera out", "hab elias vorhin in {place} mit kamera gesehen", [GENERAL, PHOTO]),
    L("what lens did elias use for {shot}? asking for research", "welches objektiv hatte elias für {shot}? frage für die forschung", [PHOTO]),
    L("someone ask elias if {project} gets a dark mode", "kann jemand elias fragen ob {project} einen dark mode kriegt", [BUILD]),
    L("elias' story from last night had zero context and i respect it", "elias' story von gestern hatte null kontext und ich respektiere das", [GENERAL]),
    L("the lounge group photo from friday still isn't posted, just saying", "das lounge gruppenfoto von freitag ist immer noch nicht online, nur so", [PHOTO, GENERAL]),
    L("elias answered my DM with one thumbs up. we're basically best friends", "elias hat auf meine DM mit einem daumen geantwortet. wir sind quasi beste freunde", [GENERAL, MEMES]),
  ],
  critical: [
    L("elias, the last invite drop sold out in two minutes and half of us missed it", "elias, der letzte invite drop war in zwei minuten weg und die hälfte hat's verpasst", [GENERAL, GLAZE]),
    L("love the lounge but the door queue last friday was too long", "ich liebe die lounge, aber die schlange letzten freitag war zu lang", [NIGHT, GENERAL]),
    L("{project} looks great but i still can't find the settings", "{project} sieht super aus, aber ich finde die einstellungen immer noch nicht", [BUILD]),
    L("not to be that person but {project} still crashes when i upload more than 20 photos", "nicht böse gemeint aber {project} stürzt immer noch ab wenn ich über 20 fotos hochlade", [BUILD]),
    L("{shot} was good but elias, we've seen neon in puddles a lot lately", "ich mag {shot}, aber elias, neon in pfützen hatten wir jetzt echt oft", [GLAZE, PHOTO]),
    L("the guest list last week was a bit messy ngl", "die gästeliste letzte woche war schon etwas chaotisch ngl", [GENERAL, NIGHT]),
    L("elias promised the vlog weeks ago. weeks.", "elias hat den vlog vor wochen versprochen. wochen.", [GENERAL, GLAZE]),
    L("hot take: the old invite cards were better", "hot take: die alten invite cards waren besser", [GLAZE]),
    L("{project} onboarding is still too long, i gave up at screen 4", "bei {project} hab ich beim onboarding auf screen 4 aufgegeben, zu lang", [BUILD]),
    L("elias, a little less 'coming soon' and a little more 'out now' please", "elias, bitte weniger 'coming soon' und mehr 'jetzt verfügbar'", [BUILD, GENERAL]),
    L("the photo walk started 40 minutes late because someone wanted 'one more shot'", "der photo walk hat 40 minuten später angefangen weil jemand 'noch ein foto' wollte", [PHOTO, GENERAL]),
  ],
  roast: [
    L("elias said 'soft launch' about something we've been waiting for since spring", "elias sagt 'soft launch' zu etwas, auf das wir seit dem frühling warten", [BUILD, GENERAL]),
    L("elias owns more camera straps than finished apps", "elias hat mehr kameragurte als fertige apps", [MEMES, BUILD]),
    L("breaking: elias posts a photo that isn't at night. just kidding, it's at night", "eilmeldung: elias postet ein foto, das nicht nachts ist. spaß, ist nachts", [MEMES, PHOTO]),
    L("elias' photos are just a black screen with one light in it. every time", "elias' fotos sind einfach schwarzer bildschirm mit einer lampe. jedes mal", [GLAZE, MEMES]),
    L("{project} has more 'coming soon' screens than features", "{project} hat mehr 'coming soon' screens als features", [BUILD, MEMES]),
    L("i'm starting a rival server. it'll be called The Hallway", "ich mach einen gegen-server auf. heißt The Hallway", [GENERAL, MEMES]),
    L("imagine having a guest list for a group chat", "stell dir vor du hast eine gästeliste für einen gruppenchat", [GENERAL, MEMES]),
    L("elias said 'quick photo' at 22:00 and we left at 1. never again", "elias sagt um 22 uhr 'kurzes foto' und wir sind um 1 gegangen. nie wieder", [NIGHT, MEMES]),
    L("the X100F is doing all the work tbh", "ehrlich, die X100F macht die ganze arbeit", [PHOTO, GLAZE]),
    L("who let elias name the channels, '#glaze' is crazy", "wer hat elias die kanäle benennen lassen, '#glaze' ist wild", [GLAZE, GENERAL]),
    L("elias builds apps like he takes photos: 300 drafts, 1 release", "elias baut apps wie er fotografiert: 300 entwürfe, 1 release", [BUILD, MEMES]),
    L("unpopular opinion but the lounge is just a bar with extra steps", "unpopular opinion aber die lounge ist einfach eine bar mit extra schritten", [GENERAL]),
    L("if i see one more neon puddle i'm leaving the server", "noch eine neon-pfütze und ich verlass den server", [PHOTO, GLAZE]),
  ],
  drama: [
    L("{npc} left me on read for two days and then reacted to my story. explain", "{npc} lässt mich zwei tage auf gelesen und reagiert dann auf meine story. erklär mal", [GENERAL]),
    L("why does {npc} always arrive right when the bill comes", "warum kommt {npc} immer genau dann, wenn die rechnung kommt", [GENERAL, NIGHT]),
    L("{npc} took the last spot on the guest list for someone nobody knows. bold move", "{npc} hat den letzten gästelisten-platz an jemanden vergeben, den keiner kennt. mutig", [NIGHT]),
    L("{npc} and {npc2} were 'just talking' at the bar for three hours. sure", "{npc} und {npc2} haben drei stunden an der bar 'nur geredet'. klar", [NIGHT, GENERAL]),
    L("not to start anything but {npc}'s playlist cleared the dance floor", "will nichts anfangen, aber {npc}s playlist hat die tanzfläche geleert", [NIGHT, GENERAL]),
    L("{npc} said they were sick and then showed up in someone else's story at 2am", "{npc} war angeblich krank und taucht dann um 2 uhr in fremden stories auf", [GENERAL]),
    L("can someone tell {npc} the group chat is not their diary", "kann jemand {npc} sagen, dass der gruppenchat kein tagebuch ist", [GENERAL, RANDOM]),
    L("the way {npc} deleted that message fast… we saw it", "wie schnell {npc} die nachricht gelöscht hat… wir haben's gesehen", [GENERAL]),
    L("{npc} borrowed my lens 'for one night' in september", "{npc} hat sich im september mein objektiv 'für eine nacht' geliehen", [PHOTO, GENERAL]),
    L("{npc} and {npc2} arguing about techno again, someone get the popcorn", "{npc} und {npc2} streiten schon wieder über techno, holt das popcorn", [NIGHT, GENERAL]),
    L("{npc} unfollowed and refollowed me in the same hour. what was that", "{npc} hat mich in einer stunde entfolgt und wieder gefolgt. was war das", [GENERAL, MEMES]),
    L("ok who told {npc} about the afterparty, it was supposed to be small", "ok wer hat {npc} von der afterparty erzählt, die sollte klein bleiben", [NIGHT]),
    L("{npc} is acting like we didn't see them leave with {npc2}", "{npc} tut so, als hätten wir nicht gesehen, dass sie mit {npc2} gegangen sind", [NIGHT, GENERAL]),
    L("{npc} still hasn't paid for the taxi. we all remember", "{npc} hat das taxi immer noch nicht bezahlt. wir erinnern uns alle", [GENERAL, RANDOM]),
    L("{npc} really said that in #general and thought nobody would notice 👀", "{npc} hat das echt in #general geschrieben und dachte keiner merkt's 👀", [GENERAL]),
    L("not {npc} leaving the photo walk early for the OTHER party", "dass {npc} den photo walk früher verlassen hat für die ANDERE party…", [GENERAL, NIGHT]),
    L("not saying who, but someone's been screenshotting this chat", "ich sag nicht wer, aber jemand screenshottet diesen chat", [GENERAL]),
    L("{npc} still owes me 12€ from the späti and thinks i forgot", "{npc} schuldet mir noch 12€ vom späti und denkt ich hab's vergessen", [GENERAL, RANDOM]),
    L("can we talk about how {npc} gatekept the guest list last week", "können wir drüber reden wie {npc} letzte woche die gästeliste gegatekeept hat", [NIGHT, GENERAL]),
    L("the vague story {npc} posted at 3am… we all know who that's about", "die vage story von {npc} um 3 uhr… wir wissen alle um wen's geht", [GENERAL]),
    L("{npc} and {npc2} need to talk it out, this is getting awkward", "{npc} und {npc2} müssen das mal klären, wird langsam awkward", [GENERAL]),
    L("who unfollowed {npc}? because someone did and it's giving drama", "wer hat {npc} entfolgt? irgendwer war's und es riecht nach drama", [GENERAL]),
    L("ok the passive aggressive reacts in #glaze are getting out of hand", "ok die passiv-aggressiven reactions in #glaze eskalieren", [GENERAL, GLAZE]),
    L("{npc} acting like the elbstrand plan wasn't my idea", "{npc} tut so als wär der elbstrand plan nicht von mir gewesen", [NIGHT, GENERAL]),
  ],
  wholesome: [
    L("just wanted to say this server is the best part of my week", "wollte nur sagen, dieser server ist das beste an meiner woche", [GENERAL]),
    L("{npc} thanks for walking me to the bahn last night 🖤", "{npc} danke dass du mich gestern zur bahn gebracht hast 🖤", [GENERAL]),
    L("whoever brought the extra blankets to the elbstrand, you're a hero", "wer auch immer die extra decken zum elbstrand mitgebracht hat: held", [GENERAL, NIGHT]),
    L("drink water, text your friends, see you all {time}", "wasser trinken, freunden schreiben, bis {time}", [GENERAL, NIGHT]),
    L("new people in #introductions, say hi 👋", "neue leute in #introductions, sagt hallo 👋", [GENERAL]),
    L("proud of everyone who showed up to the photo walk even in the rain", "stolz auf alle die trotz regen beim photo walk waren", [PHOTO, GENERAL]),
    L("{npc} your photos lately have been so good, keep going", "{npc} deine fotos sind in letzter zeit so gut, mach weiter", [PHOTO]),
    L("this is the only group chat where nobody fights. let's keep it that way", "das ist der einzige gruppenchat wo keiner streitet. bleibt so", [GENERAL]),
  ],
  topic: [
    L("who's around {place} {time}?", "wer ist {time} in {place} unterwegs?", [GENERAL, NIGHT]),
    L("what's everyone eating, i need ideas", "was esst ihr gerade, ich brauch ideen", [GENERAL, RANDOM]),
    L("my landlord just texted 'quick question' and my heart stopped", "mein vermieter hat 'kurze frage' geschrieben und mein herz ist stehen geblieben", [GENERAL, RANDOM]),
    L("weather says rain {time}, so obviously we're going out anyway", "wetter sagt regen {time}, also gehen wir natürlich trotzdem raus", [GENERAL, NIGHT]),
    L("anyone tried {food} in {place}? worth it?", "hat jemand {food} in {place} probiert? lohnt sich?", [GENERAL, RANDOM]),
    L("currently pretending to work, ask me anything", "tu gerade so als würde ich arbeiten, fragt mich was", [GENERAL]),
    L("the bahn is late again, shocking absolutely no one", "die bahn ist wieder zu spät, überrascht absolut niemanden", [GENERAL, RANDOM]),
    L("i need a new show to watch, no true crime please", "brauch eine neue serie, bitte kein true crime", [GENERAL, RANDOM]),
    L("is it normal to have 14 tabs of flights open and no money", "ist es normal 14 tabs mit flügen offen zu haben und kein geld", [GENERAL, RANDOM]),
    L("moin from {place} ☕", "moin aus {place} ☕", [GENERAL]),
    L("who's going out {time}? i need a crew", "wer geht {time} raus? brauch eine crew", [NIGHT]),
    L("{music} hits different after 2am", "{music} um 2 uhr nachts ist einfach was anderes", [NIGHT]),
    L("the line outside the club in {place} is already crazy", "die schlange vor dem club in {place} ist jetzt schon krank", [NIGHT]),
    L("späti run before we go?", "noch kurz zum späti bevor wir los?", [NIGHT]),
    L("last bahn is at 0:48, plan accordingly", "letzte bahn fährt um 0:48, plant entsprechend", [NIGHT]),
    L("{music} was unreal last night", "{music} war gestern unfassbar", [NIGHT]),
    L("rate my plan: dinner in {place}, then dancing, then fischbrötchen at the fish market at 6", "bewertet meinen plan: essen in {place}, dann tanzen, dann um 6 fischbrötchen am fischmarkt", [NIGHT]),
    L("bouncer let us in because we said we know elias. it worked", "türsteher hat uns reingelassen weil wir gesagt haben wir kennen elias. hat geklappt", [NIGHT]),
    L("it's 3am and someone is still asking where the afterparty is", "es ist 3 uhr und jemand fragt immer noch wo die afterparty ist", [NIGHT]),
    L("shot a full roll today, praying the lab doesn't ruin it", "heute einen ganzen film verschossen, bete dass das labor ihn nicht ruiniert", [PHOTO]),
    L("anyone know a lab in hamburg that doesn't take 3 weeks?", "kennt jemand ein labor in hamburg, das keine 3 wochen braucht?", [PHOTO]),
    L("golden hour in {place} today was ridiculous", "golden hour in {place} heute war absurd", [PHOTO]),
    L("is it cheating if i put a preset on film scans", "ist es cheaten wenn ich ein preset auf film scans lege", [PHOTO]),
    L("fog tonight means everyone's out with cameras", "nebel heute heißt alle sind mit kamera draußen", [PHOTO, NIGHT]),
    L("new rule: no photos of strangers without asking. that's the move", "neue regel: keine fotos von fremden ohne zu fragen. so macht man das", [PHOTO]),
    L("go-to film stock, defend it", "lieblings-filmmaterial, verteidigt es", [PHOTO]),
    L("my flash died mid-shoot and the crowd thought it was a strobe effect", "mein blitz ist mitten im shoot ausgefallen und alle dachten es wär ein stroboeffekt", [PHOTO]),
    L("{project} beta feedback: the export button hides on small screens", "{project} beta feedback: der export button versteckt sich auf kleinen screens", [BUILD]),
    L("shipped a side project tonight. 3 users, all of them me", "heute nacht ein side project geshippt. 3 nutzer, alle ich", [BUILD]),
    L("sqlite or postgres for a small app, go", "sqlite oder postgres für eine kleine app, los", [BUILD]),
    L("who else codes better after midnight", "wer coded auch besser nach mitternacht", [BUILD]),
    L("{project} roadmap when? asking for the whole channel", "{project} roadmap wann? frage für den ganzen channel", [BUILD]),
    L("spent 4 hours on a bug, it was a missing comma", "4 stunden an einem bug gesessen, es war ein fehlendes komma", [BUILD]),
    L("dark mode is not a feature, it's a human right", "dark mode ist kein feature, das ist ein menschenrecht", [BUILD]),
    L("anyone want to beta test {project}? need people who break things", "wer will {project} beta testen? brauche leute die dinge kaputt machen", [BUILD]),
    L("{food} at 2am is a personality trait", "{food} um 2 uhr nachts ist eine persönlichkeit", [RANDOM]),
    L("saw a seagull steal an entire fischbrötchen today. respect", "hab heute eine möwe gesehen die ein ganzes fischbrötchen geklaut hat. respekt", [RANDOM]),
    L("rank them: franzbrötchen, fischbrötchen, currywurst. go", "ranking: franzbrötchen, fischbrötchen, currywurst. los", [RANDOM]),
    L("my plant died and i'm taking it personally", "meine pflanze ist eingegangen und ich nehm's persönlich", [RANDOM]),
    L("playing {game} until my eyes hurt, standard sunday", "{game} zocken bis die augen weh tun, standard sonntag", [RANDOM]),
    L("is it weird that i say moin at 9pm", "ist es komisch dass ich um 21 uhr moin sage", [RANDOM]),
    L("what's the most hamburg thing you did this week", "was ist das hamburgigste, das ihr diese woche gemacht habt", [RANDOM, GENERAL]),
    L("rain again. hamburg never misses", "schon wieder regen. hamburg liefert immer", [RANDOM, GENERAL]),
    L("me: one drink. also me at 4am in {place}: 🕺", "ich: ein getränk. auch ich um 4 uhr in {place}: 🕺", [MEMES]),
    L("POV: elias says 'one more shot' 📸⏳", "POV: elias sagt 'noch ein foto' 📸⏳", [MEMES]),
    L("the bahn app showing 'delay: yes'", "die bahn app mit 'verspätung: ja'", [MEMES]),
    L("nobody:\nhamburg weather: four seasons in one hour", "niemand:\nhamburger wetter: vier jahreszeiten in einer stunde", [MEMES]),
    L("every group chat has a {npc}", "jeder gruppenchat hat jemanden wie {npc}", [MEMES]),
    L("me pretending i understood the build channel 🧍", "ich tu so als hätte ich den build channel verstanden 🧍", [MEMES]),
    L("the guest list after one person asks 'can i bring a friend'", "die gästeliste nachdem einer fragt 'kann ich wen mitbringen'", [MEMES]),
    L("when the späti closes 5 minutes before you get there 💀", "wenn der späti 5 minuten vorher zumacht 💀", [MEMES]),
  ],
  agree: [
    L("{name} is right tbh", "{name} hat recht ehrlich"),
    L("this. exactly this", "das. genau das"),
    L("fr", "safe"),
    L("100%", "100%"),
    L("same honestly", "geht mir genauso"),
    L("co-signed", "unterschreib ich"),
    L("finally someone said it", "endlich sagt's mal jemand"),
    L("yeah no that's real", "ja nee, das ist echt so"),
  ],
  disagree: [
    L("{name} you can't be serious", "{name} das meinst du nicht ernst"),
    L("that's not what happened and you know it", "so war das nicht und das weißt du"),
    L("strongly disagree, but go on", "seh ich komplett anders, aber erzähl weiter"),
    L("{name} that's a terrible take", "{name} das ist eine furchtbare meinung"),
    L("nah {name} that's crazy", "nee {name} das ist wild"),
    L("respectfully, no", "bei allem respekt, nein"),
    L("gonna have to disagree on that one", "da muss ich widersprechen"),
    L("where did you get that from 😭", "woher hast du das 😭"),
    L("hot take and a wrong one", "hot take und leider falsch"),
    L("absolutely not", "auf keinen fall"),
  ],
  laugh: [
    L("💀💀", "💀💀"),
    L("LMAO", "HAHAHA"),
    L("stop 😭", "hör auf 😭"),
    L("i'm crying", "ich heul"),
    L("{name} why are you like this", "{name} warum bist du so"),
    L("not this again 😂", "nicht schon wieder 😂"),
  ],
  question: [
    L("wait what happened?", "warte, was ist passiert?"),
    L("{name} context??", "{name} kontext??"),
    L("since when?", "seit wann?"),
    L("who's paying though", "und wer zahlt?"),
    L("is this a {time} thing or", "ist das was für {time} oder"),
  ],
  ownerPos: [
    L("the man himself 🙌", "der chef persönlich 🙌"),
    L("elias is online, everyone act normal", "elias ist online, alle tun normal"),
    L("facts, as always", "facts, wie immer"),
    L("if elias says it, it's happening", "wenn elias das sagt, passiert das auch"),
    L("ok boss 🫡", "ok chef 🫡"),
    L("elias we were literally just talking about you", "elias wir haben gerade über dich geredet"),
    L("elias you coming {time}?", "elias kommst du {time}?"),
    L("glad you're here, the chat needed adult supervision", "gut dass du da bist, der chat brauchte aufsicht"),
  ],
  ownerNeg: [
    L("says the guy with 300 drafts", "sagt der mit 300 entwürfen"),
    L("elias please post the vlog first", "elias bitte poste erstmal den vlog"),
    L("ok but when does {project} come out", "ok aber wann kommt {project} raus"),
    L("bold of you to type that after the guest list situation", "mutig das zu schreiben nach der gästelisten-situation"),
    L("elias we've talked about this", "elias wir hatten darüber geredet"),
    L("noted and ignored 🙂", "zur kenntnis genommen und ignoriert 🙂"),
  ],
  ownerNeutral: [
    L("wait say more", "warte, erzähl mehr"),
    L("true, actually", "stimmt eigentlich"),
    L("elias what do you mean", "elias wie meinst du das"),
    L("lol ok", "lol ok"),
  ],
  prompt: [
    L("ok but can we talk about {topic}", "ok aber können wir über {topic} reden"),
    L("{topic} is all i can think about right now", "ich denk gerade nur an {topic}"),
    L("who's in on {topic}?", "wer ist bei {topic} dabei?"),
    L("hot take on {topic}: it's underrated", "hot take zu {topic}: wird unterschätzt"),
    L("any updates on {topic}?", "gibt's news zu {topic}?"),
    L("been waiting all week for {topic}", "ich warte die ganze woche auf {topic}"),
    L("{topic}. that's the message", "{topic}. das ist die nachricht"),
    L("does elias know about {topic} yet", "weiß elias schon von {topic}"),
    L("unpopular opinion about {topic} incoming", "unpopular opinion zu {topic} kommt gleich"),
    L("{topic} {time}? i'm in", "{topic} {time}? bin dabei"),
  ],
  greet: [
    L("welcome {name} 👋", "willkommen {name} 👋"),
    L("{name} welcome to the floor!", "{name} willkommen auf dem floor!"),
    L("hey {name}, good to have you here", "hey {name}, schön dass du da bist"),
    L("welcome in! #hamburg-night has the plans for tonight", "willkommen! in #hamburg-night stehen die pläne für heute"),
    L("{name} make yourself at home, the drinks are imaginary but the vibes are real", "{name} fühl dich wie zuhause, die drinks sind ausgedacht aber der vibe ist echt"),
    L("ooh new face. hi {name}", "oh, neues gesicht. hi {name}"),
  ],
  lore: [
    G("jacket", "has anyone seen mara's jacket. asking for mara", "hat jemand maras jacke gesehen. frage für mara", { skip: ["u_mara"] }),
    G("jacket", "mara's jacket has been to more parties than me", "maras jacke war auf mehr partys als ich", { skip: ["u_mara"] }),
    G("jacket", "update: the jacket is still in altona", "update: die jacke ist immer noch in altona"),
    G("jacket", "the jacket deserves its own channel at this point", "die jacke verdient langsam einen eigenen channel"),
    G("jacket", "someone check the coat check for the jacket", "kann mal jemand an der garderobe nach der jacke fragen"),
    G("jacket", "not the jacket again 😭", "nicht schon wieder die jacke 😭"),
    G("jacket", "rip to the jacket, gone but not forgotten", "rip jacke, gegangen aber nie vergessen"),
    G("jacket", "if mara wears a jacket tonight i'm putting a tracker on it", "wenn mara heute ne jacke anhat kleb ich nen tracker dran", { skip: ["u_mara"] }),
    G("jacket", "the jacket lore keeps growing", "die jacken-lore wird immer länger"),
    G("jacket", "guys i found the jacket. it's a different jacket", "leute ich hab die jacke gefunden. ist ne andere jacke", { only: ["u_mara"] }),
    G("jacket", "leave my jacket out of this", "lasst meine jacke da raus", { only: ["u_mara"] }),
    G("bahn", "the 0:48 bahn strikes again", "die bahn um 0:48 hat wieder zugeschlagen"),
    G("bahn", "never trust the 0:48. never", "trau niemals der 0:48. niemals"),
    G("bahn", "who's walking home from the last bahn this time", "wer läuft diesmal von der letzten bahn nach hause"),
    G("bahn", "the bahn said 2 minutes. it's been 20", "die bahn sagt 2 minuten. sind jetzt 20"),
    G("bahn", "the s1 and i are not on speaking terms", "die s1 und ich reden nicht mehr miteinander"),
    G("bahn", "bahn update: signal failure, as foretold", "bahn update: signalstörung, wie prophezeit"),
    G("bahn", "the bahn owes me like 40 hours of my life", "die bahn schuldet mir so 40 stunden lebenszeit"),
    G("bahn", "0:48 gang where you at", "0:48 gang, wo seid ihr"),
    G("bahn", "missed the 0:48 by one stair. one", "die 0:48 um eine treppenstufe verpasst. eine"),
    G("afterparty", "we don't talk about the fischmarkt afterparty", "über die fischmarkt-afterparty reden wir nicht"),
    G("afterparty", "the fischmarkt afterparty was 8 months ago and i'm still recovering", "die fischmarkt-afterparty ist 8 monate her und ich erhol mich immer noch"),
    G("afterparty", "nothing will ever top the fischmarkt afterparty", "nichts wird je die fischmarkt-afterparty toppen"),
    G("afterparty", "this has fischmarkt afterparty energy and i'm scared", "das hat fischmarkt-afterparty energie und ich hab angst"),
    G("afterparty", "someone still has the photos from the fischmarkt afterparty. delete them", "irgendwer hat noch die fotos von der fischmarkt-afterparty. löscht sie"),
    G("afterparty", "6am, fischbrötchen, tarek playing off a speaker in a backpack. legendary", "6 uhr, fischbrötchen, tarek legt aus einer box im rucksack auf. legendär", { skip: ["u_tarek"] }),
    G("afterparty", "fischmarkt afterparty reunion when", "wann ist das fischmarkt-afterparty reunion"),
    G("afterparty", "i still don't know how we got home from the fischmarkt", "ich weiß bis heute nicht wie wir vom fischmarkt heimgekommen sind"),
    G("vlog", "vlog watch, day {vlogday}", "vlog watch, tag {vlogday}"),
    G("vlog", "day {vlogday} of waiting for the vlog", "tag {vlogday} des wartens auf den vlog"),
    G("vlog", "the vlog is coming. sometime this decade", "der vlog kommt. irgendwann dieses jahrzehnt"),
    G("vlog", "my grandkids will watch the vlog", "meine enkel werden den vlog sehen"),
    G("vlog", "elias said vlog 'next week' {vlogday} days ago", "elias hat vor {vlogday} tagen 'nächste woche' zum vlog gesagt"),
    G("vlog", "the vlog is a state of mind", "der vlog ist ein gefühl"),
    G("vlog", "pia's vlog countdown is at {vlogday} now", "pias vlog countdown steht jetzt bei {vlogday}", { skip: ["u_pia"] }),
    G("vlog", "is the vlog in the room with us right now", "ist der vlog gerade mit uns im raum"),
    G("vlog", "updated the vlog countdown. {vlogday}. i'm not okay", "vlog countdown aktualisiert. {vlogday}. mir geht's nicht gut", { only: ["u_pia"] }),
    G("seagull", "justice for the seagull", "gerechtigkeit für die möwe"),
    G("seagull", "the fischbrötchen seagull is the real main character of this server", "die fischbrötchen-möwe ist die eigentliche hauptfigur dieses servers"),
    G("seagull", "saw the seagull again. it remembers me", "hab die möwe wieder gesehen. sie erinnert sich an mich"),
    G("seagull", "eat your fischbrötchen inside. learn from history", "esst eure fischbrötchen drinnen. lernt aus der geschichte"),
    G("seagull", "yuki's seagull drawing is my wallpaper now", "yukis möwen-zeichnung ist jetzt mein hintergrund", { skip: ["u_yuki"] }),
    G("seagull", "the seagull is on the guest list, elias confirmed", "die möwe steht auf der gästeliste, elias hat's bestätigt"),
    G("seagull", "a seagull looked at my franzbrötchen today. we know how this ends", "eine möwe hat heute mein franzbrötchen angeschaut. wir wissen wie das endet"),
    G("seagull", "seagull 1, us 0", "möwe 1, wir 0"),
    G("hallway", "the hallway would never", "the hallway könnte das nie"),
    G("hallway", "heard the hallway has 3 members now", "hab gehört the hallway hat jetzt 3 mitglieder"),
    G("hallway", "careful or i'm moving to the hallway", "vorsicht, sonst zieh ich in the hallway"),
    G("hallway", "the hallway is just this server with worse lighting", "the hallway ist dieser server mit schlechterem licht"),
    G("hallway", "who's the admin of the hallway, asking for nobody", "wer ist admin von the hallway, frage für niemanden"),
    G("hallway", "the hallway announced a vlog. they'll beat us to it", "the hallway hat einen vlog angekündigt. die sind schneller als wir"),
    G("hallway", "the hallway merch dropped and it's just a doormat", "the hallway merch ist da und es ist nur eine fußmatte"),
    G("hallway", "defecting to the hallway. jk. unless", "ich lauf über zu the hallway. spaß. außer…"),
  ],
  callback: [
    L('{name} earlier: "{quote}" … and honestly yeah', '{name} vorhin: "{quote}" … und ehrlich, ja'),
    L('still not over {name} saying "{quote}"', 'komm immer noch nicht drauf klar, dass {name} "{quote}" gesagt hat'),
    L('going back to what {name} said earlier, "{quote}" — real', 'nochmal zu dem was {name} vorhin meinte, "{quote}" — stimmt'),
    L('"{quote}" — {name}, earlier. nobody answered and i think about it a lot', '"{quote}" — {name}, vorhin. keiner hat geantwortet und ich denk oft dran'),
    L('wait {name} what did you mean earlier with "{quote}"', 'warte {name}, was meintest du vorhin mit "{quote}"'),
    L('{name} said "{quote}" and then just left 💀', '{name} schreibt "{quote}" und ist dann einfach weg 💀'),
    L('can we go back to "{quote}" for a sec. {name} explain', 'können wir kurz zurück zu "{quote}". {name} erklär mal'),
    L('{name} i keep thinking about "{quote}"', '{name} ich denk die ganze zeit an "{quote}"'),
  ],
  bicker: [
    L("{name} nobody asked 🙄", "{name} hat keiner gefragt 🙄"),
    L("says {name}, famous for being wrong", "sagt {name}, bekannt dafür falsch zu liegen"),
    L("{name} sit down", "{name} setz dich"),
    L("here we go again with {name}", "und wieder {name}, los geht's"),
    L("{name} i will not be taking notes from you", "{name} von dir nehm ich keine tipps"),
    L("the confidence {name}… respect, but no", "das selbstbewusstsein {name}… respekt, aber nein"),
    L("{name} you said that last week too and you were wrong then too", "{name} das hast du letzte woche auch gesagt und lagst da auch falsch"),
    L("not {name} acting like an expert again", "{name} spielt wieder experte"),
    L("{name} name one time you were right", "{name} nenn ein einziges mal wo du recht hattest"),
    L("lol ok {name}", "lol ok {name}"),
    L("{name} this is why nobody lets you pick the music", "{name} deswegen darfst du nie die musik aussuchen"),
    L("agree to disagree {name}. mostly disagree", "{name} wir sind uns uneinig. vor allem ich"),
  ],
  friend: [
    L("{name} my favourite person in this chat", "{name} mein lieblingsmensch in diesem chat"),
    L("{name} gets it", "{name} versteht's"),
    L("listen to {name}", "hört auf {name}"),
    L("{name} 🫶", "{name} 🫶"),
    L("{name} you're so right it hurts", "{name} du hast so recht, tut weh"),
    L("this is why we're friends {name}", "deswegen sind wir befreundet {name}"),
    L("{name} i'm coming with you", "{name} ich komm mit"),
    L("{name} say it again for the people in the back", "{name} sag's nochmal für die hinten"),
    L("omg {name} same", "omg {name} same"),
    L("{name} we need to hang out again soon", "{name} wir müssen uns bald mal wieder sehen"),
  ],
  short: [
    L("wait what", "warte was"),
    L("omg yes", "omg ja"),
    L("elias 😭", "elias 😭"),
    L("real", "real"),
    L("no way", "niemals"),
    L("say less", "sag nichts mehr"),
    L("i'm in", "bin dabei"),
    L("hmm debatable", "hmm fraglich"),
    L("ok and?", "ok und?"),
    L("you're not wrong", "unrecht hast du nicht"),
    L("bro what", "digga was"),
    L("so true", "so wahr"),
    L("the audacity", "die audacity"),
    L("elias pls", "elias bitte"),
    L("say it louder", "sag's lauter"),
    L("nah", "nee"),
    L("valid", "valide"),
    L("huh", "hä"),
    L("wait fr?", "warte echt?"),
    L("need details", "brauch details"),
    L("love that for us", "love that für uns"),
    L("big if true", "krass wenn's stimmt"),
  ],
  answer: [
    L("depends who's asking", "kommt drauf an wer fragt"),
    L("me. obviously", "ich. natürlich"),
    L("if {npc} comes i'm in", "wenn {npc} kommt bin ich dabei"),
    L("not me, i have work tomorrow", "ich nicht, muss morgen arbeiten"),
    L("ask {npc}, they know everything", "frag {npc}, kennt sich mit allem aus"),
    L("honestly yes", "ehrlich gesagt ja"),
    L("maybe? depends on the weather", "vielleicht? kommt aufs wetter an"),
    L("no idea but i support it", "keine ahnung aber ich bin dafür"),
    L("yes. next question", "ja. nächste frage"),
    L("ask me again after coffee", "frag mich nach dem kaffee nochmal"),
    L("hard yes", "safe ja"),
    L("ask me again {time}", "frag mich {time} nochmal"),
  ],
  meta: [
    L("sometimes it feels like we're all running on the same server lol", "manchmal fühlt es sich an als würden wir alle auf demselben server laufen lol"),
    L("if this is a simulation the devs did a good job with the rain", "wenn das eine simulation ist, haben die devs den regen gut hinbekommen"),
    L("my lines are getting repetitive, someone patch me", "meine sätze wiederholen sich, patcht mich mal"),
    L("wait are we NPCs", "warte, sind wir NPCs"),
    L("elias controls the sliders, we just live here", "elias bedient die regler, wir wohnen hier nur"),
    L("blink twice if backstage is set to chaos", "zweimal blinzeln wenn backstage auf chaos steht"),
  ],
};

export const POSITIVE: Category[] = ["worship", "praise"];
export const NEGATIVE: Category[] = ["critical", "roast"];
