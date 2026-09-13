/* ============================================================================
   Coach Tools · Competitions function
   Shared, discipline-neutral read-only proxy over the Coach Tools Airtable
   base's competition architecture:

     Discipline
       -> Competition Events        (tbl3o1xE2FwUsiEgz)
       -> Competition Formats & Rules (tblpduCBZElIAmtBL, linked from Events)
       -> Gymnastics Competition Requirements (tblrHQY0tBQhvhPWr, linked from
          Events; gymnastics-only, empty array for other disciplines)

   This function is READ-ONLY — it never writes to Airtable. The three
   tables' schema, fields and records were created/populated separately;
   this function only reads and joins them by linked-record ID (never by
   display name or record order).

   All three tables are queried with `returnFieldsByFieldId=true` so every
   field is addressed by its stable field ID (as given in the project spec)
   rather than its display name — the same content is reachable whichever
   collaborator later renames a column in Airtable.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT — same token used by every other Airtable-backed function
                    in this app (videos.mts, syllabus.mts, etc.)

   GET /.netlify/functions/competitions?discipline=Gymnastics&season=2026/27
     -> { events: CompetitionEvent[] }
     `discipline` (optional) — "Gymnastics" | "Football" | "Cricket" | "Athletics"
     `season` (optional)     — exact match against the Season text field, e.g. "2026/27"

     Events are filtered to Active !== false (a missing/unset Active
     checkbox is treated as active, matching Airtable's convention that an
     unchecked checkbox is simply absent from the API response — only an
     explicit false excludes a record), then sorted by real Event Date
     ascending, with events that have no confirmed date (e.g. "May 2027 —
     date TBC") sorted after all dated events, and Display Order used as
     the tie-break within either group.

     Every event carries its own `rules` (the linked Competition Formats &
     Rules record, normalized — or null if no rules record is linked) and,
     for Gymnastics events only, `gymnasticsRequirements` (an array of the
     linked Gymnastics Competition Requirements records, sorted by their
     own Display Order).

     Blank/unset fields are returned as `undefined`/`null` — never coerced
     to 0, false or an empty-but-present string — so the frontend can tell
     "genuinely not specified" apart from a real zero. Formatting blanks as
     "TBC"/"Not specified" is a display concern, handled in
     shared/competitions-ui.js, not here.
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const EVENTS_TABLE_ID = 'tbl3o1xE2FwUsiEgz';
const RULES_TABLE_ID = 'tblpduCBZElIAmtBL';
const REQUIREMENTS_TABLE_ID = 'tblrHQY0tBQhvhPWr';

// ---- Competition Events field IDs -----------------------------------------
const EV = {
  eventName: 'fldApNjXceH9W9sYQ',
  eventId: 'fld8EKYmnveDlzmQ0',
  discipline: 'fldtn6Q3T0LdQDim2',
  governingBody: 'fldC0ttGzjaFwmcA5',
  competitionName: 'fld6Zunqxq51ikqHa',
  season: 'fld3uhdO4Om6JkmvP',
  eventDate: 'fld1tDOz9BI2aMstd',
  dateDisplay: 'fldRTCqtAZ5XwuGWL',
  dateStatus: 'fldm0ZplFPzURhvQN',
  location: 'fld4XTNqkIONCV1Pl',
  venueName: 'fldBXG00gYJE38dXg',
  venueAddress: 'fldfF5IIdbVsJl84E',
  category: 'fldb7eKo6G3JNw6DV',
  eventType: 'fldRwyJVJwKUmRhAp',
  registrationTime: 'fldoFkmTD2vFRI41i',
  coachesBriefingTime: 'fldQLp33liroMKlWA',
  eventStartTime: 'fldf5uSdtRKNr8RTJ',
  eventEndTime: 'flduVR2zpIkfTVlFx',
  girlsParticipation: 'fld1CIdjpkfLFXoSL',
  boysParticipation: 'fldupQgP1HNQWPyZI',
  teamRuleDisplay: 'flde4mLHNY2tMzyfx',
  categoryNotes: 'fldDu2FrpDRSQV1Rm',
  generalNotes: 'fldE8KFwx24Sp5oSD',
  participationStatus: 'fldn7qEFB270yNhRJ',
  sourceUrl: 'fldBStsELJ2skeT7L',
  sourceDescription: 'fldn8YizEmSO9AJ8I',
  active: 'fldMjxswldzatQlmf',
  displayOrder: 'fldu3omyqaLACZZmg',
  // Reverse link fields (auto-created by Airtable; not individually named in
  // the spec, but discovered from the base schema — always addressed by ID).
  rulesLink: 'fldcr14z52SEr6Rpb',
  requirementsLink: 'fldJohnGYjCJncYF8',
  // Legacy Gymnastics convenience fields on Events — defensive fallback only,
  // used solely when an event has no linked Formats & Rules record at all.
  legacyFormat: 'fldf9UX1OAjuLHGSZ',
  legacyMinTeamSize: 'flducZGU0dRZjLTnS',
  legacyMaxSquadSize: 'fldTK3fiOlcEJh2Xj',
  legacyCompetitorsPerPiece: 'fldDzSvlDqr54OmVu',
  legacyCountingScores: 'fldvtCOixxINCmSep',
};

// ---- Competition Formats & Rules field IDs --------------------------------
const RU = {
  ruleSetName: 'fldHIo8P11DM210yu',
  competitionEventLink: 'fldv5l6Sn7bN3mlac',
  discipline: 'fld6GwJ9B64zTuR9i',
  category: 'fld0Ca4yaaGVx6z1j',
  status: 'fldIrHQIIF0HLkTrD',
  maxSquadSize: 'fldeUpxs9t7liFaBT',
  minTeamSize: 'fldrpu20bZrHnigRm',
  competitorsPerPiece: 'fldqvRZK9p8RZ2gfH',
  countingScores: 'fldnlaO8GCSrK7RyQ',
  sourceReference: 'fldcoz29svuaYbODw',
  ruleNotes: 'fldtJrMVPtkaVlZpO',
  unknownNotes: 'fld7FOPQU0XILCBdz',
  active: 'fldU6RLOzH26Fcb8V',
  // Football-only fields
  playersOnPitch: 'fldVrFY8htIZEJUuP',
  matchDurationMinutes: 'fldJcCw9iP9355zE6',
  breakMinutes: 'fldO3oQVWM9ncnAYU',
  surface: 'flddDy1qycX1a812A',
  ballSize: 'fldyJwzVere1H23QQ',
  competitionStructure: 'fldFVJO0LmxZR5oXz',
  substitutionType: 'fldl5Uu5VpDinnzzs',
  unlimitedSubstitutions: 'fld5AiIrSViKwvJKy',
  offside: 'fldjhu4ZHKLWUirDN',
  restartDistanceYards: 'fldFr70QLRFHkNCOl',
  standardLawsApply: 'fldArRckRRQmj5Tlb',
  winPoints: 'fldLMx53BwECN5uOy',
  drawPoints: 'fldVsmYEVMowgyZFv',
  lossPoints: 'fldxKW96JwVUojXdx',
  tieBreakOrder: 'fldI1FNjrHX9Mnd3L',
  extraTimeMinutes: 'fld5mXs5FbH0RLl8d',
  penaltyShootoutFormat: 'fldNO6wnn2M7ImylS',
  penaltyEligibility: 'fldLsX6rnKIkWbn19',
  equipmentRequirements: 'fldnCwU1fbZQPUOR9',
  schoolYearEligibility: 'fldzDt0VBXrPPyKq5',
  genderComposition: 'fldFcnxMt8h1EebZA',
  pitchLengthMetres: 'fldksuOqKcqoegmqz',
  pitchWidthMetres: 'fldr3KRKQPc4yEAKf',
  goalWidthMetres: 'fldXnZcjIFgK44kap',
  goalHeightMetres: 'fldLiHtLs00K0jjVb',
  penaltyAreaDimensions: 'fld3ksgM7cZ0UMOGQ',
  penaltyDistance: 'fldIok7MqWZIImgEA',
  goalkeeperDistributionRules: 'fldkGpn0LTRNTYdLN',
  retreatLineRules: 'fld9kPkyQ5SjjPa7P',
};

// ---- Gymnastics Competition Requirements field IDs ------------------------
const RQ = {
  requirementName: 'fldhfePlS6sErlQ5l',
  competitionEventLink: 'fldyxUD7m0OzlWpyV',
  gender: 'fld3pIYmQsq3m7yNb',
  piece: 'fldAxaUdvwHzO8FjN',
  required: 'fld5LsXiW6ARsox46',
  musicRequirement: 'fldd0EtBne5uXFvD2',
  requirementNotes: 'fldVA6VMDyfeVGH7L',
  displayOrder: 'fldunwlNdj4yvYcYJ',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function airtableFetch(tableId: string, query = ''): Promise<any[]> {
  const pat = Netlify.env.get('AIRTABLE_PAT');
  if (!pat) throw new Error('AIRTABLE_PAT not configured');
  const base = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?returnFieldsByFieldId=true${query}`;
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const url = base + (offset ? `&offset=${offset}` : '');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${JSON.stringify(body)}`);
    all = all.concat(body.records || []);
    offset = body.offset;
  } while (offset);
  return all;
}

// Select fields come back as { id, color, name } (or an array of those for
// multipleSelects) when returnFieldsByFieldId is set — pull the plain name.
function selName(v: any): string | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map((x) => x?.name).filter(Boolean).join(', ') || undefined;
  return v.name || undefined;
}

function str(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

function num(v: any): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function bool(v: any): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

// Linked-record fields come back as an array of { id, name } — we only ever
// need the id(s), and always resolve the real record for display text
// rather than trusting this cached `name`.
function linkIds(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => x?.id).filter(Boolean);
}

function offsideText(v: string | undefined): string | undefined {
  if (v === 'No') return 'No offside';
  if (v === 'Yes') return 'Offside applies';
  return undefined; // "Not specified" — left blank for the frontend to render as TBC/Not specified
}

function toRequirementShape(record: any) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: str(f[RQ.requirementName]),
    gender: selName(f[RQ.gender]),
    piece: selName(f[RQ.piece]),
    required: bool(f[RQ.required]),
    musicRequirement: selName(f[RQ.musicRequirement]),
    notes: str(f[RQ.requirementNotes]),
    displayOrder: num(f[RQ.displayOrder]),
  };
}

function toRulesShape(record: any) {
  const f = record.fields || {};
  const discipline = selName(f[RU.discipline]);
  const shared = {
    id: record.id,
    ruleSetName: str(f[RU.ruleSetName]),
    discipline,
    category: str(f[RU.category]),
    status: selName(f[RU.status]),
    squad: {
      maximumSquadSize: num(f[RU.maxSquadSize]),
      minimumTeamSize: num(f[RU.minTeamSize]),
      competitorsPerPiece: num(f[RU.competitorsPerPiece]),
      countingScores: num(f[RU.countingScores]),
    },
    sourceReference: str(f[RU.sourceReference]),
    ruleNotes: str(f[RU.ruleNotes]),
    unknownNotes: str(f[RU.unknownNotes]),
    active: f[RU.active] !== false,
  };

  if (discipline !== 'Football') return { ...shared, football: undefined };

  const offside = selName(f[RU.offside]);
  const unlimitedSubs = bool(f[RU.unlimitedSubstitutions]);
  const standardLaws = bool(f[RU.standardLawsApply]);

  return {
    ...shared,
    football: {
      playersOnPitch: num(f[RU.playersOnPitch]),
      matchDurationMinutes: num(f[RU.matchDurationMinutes]),
      breakMinutes: num(f[RU.breakMinutes]),
      surface: str(f[RU.surface]),
      ballSize: num(f[RU.ballSize]),
      competitionStructure: str(f[RU.competitionStructure]),
      substitutionType: str(f[RU.substitutionType]),
      unlimitedSubstitutions: unlimitedSubs,
      unlimitedSubstitutionsText: unlimitedSubs === true
        ? 'Unlimited roll-on/roll-off substitutions'
        : unlimitedSubs === false ? 'Limited substitutions' : undefined,
      offside,
      offsideText: offsideText(offside),
      restartDistanceYards: num(f[RU.restartDistanceYards]),
      standardLawsApply: standardLaws,
      standardLawsApplyText: standardLaws === true
        ? 'Normal Laws of the Game apply except where amended by the tournament rules'
        : undefined,
      points: {
        win: num(f[RU.winPoints]),
        draw: num(f[RU.drawPoints]),
        loss: num(f[RU.lossPoints]),
      },
      tieBreakOrder: str(f[RU.tieBreakOrder]),
      extraTimeMinutes: num(f[RU.extraTimeMinutes]),
      penaltyShootoutFormat: str(f[RU.penaltyShootoutFormat]),
      penaltyEligibility: str(f[RU.penaltyEligibility]),
      equipmentRequirements: str(f[RU.equipmentRequirements]),
      schoolYearEligibility: str(f[RU.schoolYearEligibility]),
      genderComposition: str(f[RU.genderComposition]),
      pitch: {
        lengthMetres: num(f[RU.pitchLengthMetres]),
        widthMetres: num(f[RU.pitchWidthMetres]),
      },
      goal: {
        widthMetres: num(f[RU.goalWidthMetres]),
        heightMetres: num(f[RU.goalHeightMetres]),
      },
      penaltyAreaDimensions: str(f[RU.penaltyAreaDimensions]),
      penaltyDistance: str(f[RU.penaltyDistance]),
      goalkeeperDistributionRules: str(f[RU.goalkeeperDistributionRules]),
      retreatLineRules: str(f[RU.retreatLineRules]),
    },
  };
}

function toEventShape(
  record: any,
  rulesById: Map<string, any>,
  requirementsByEventId: Map<string, any[]>,
) {
  const f = record.fields || {};
  const discipline = selName(f[EV.discipline]) || '';
  const ruleIds = linkIds(f[EV.rulesLink]);
  const rules = ruleIds.length ? (rulesById.get(ruleIds[0]) || null) : null;

  // Legacy Gymnastics fallback — only consulted when this event has no
  // linked Formats & Rules record at all, per the migration note in the
  // spec ("only use legacy event fields as a defensive fallback if a
  // linked rules record is absent").
  const legacySquad = !rules ? {
    maximumSquadSize: num(f[EV.legacyMaxSquadSize]),
    minimumTeamSize: num(f[EV.legacyMinTeamSize]),
    competitorsPerPiece: num(f[EV.legacyCompetitorsPerPiece]),
    countingScores: num(f[EV.legacyCountingScores]),
  } : undefined;

  const reqIds = linkIds(f[EV.requirementsLink]);
  const requirements = discipline === 'Gymnastics'
    ? reqIds
        .map((id) => requirementsByEventId.get(id))
        .filter(Boolean)
        .flat()
        .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    : undefined;

  return {
    id: record.id,
    eventId: str(f[EV.eventId]),
    discipline,
    governingBody: selName(f[EV.governingBody]),
    competitionName: str(f[EV.competitionName]),
    eventName: str(f[EV.eventName]) || '',
    season: str(f[EV.season]),
    date: str(f[EV.eventDate]),
    dateDisplay: str(f[EV.dateDisplay]),
    dateStatus: selName(f[EV.dateStatus]),
    venue: {
      name: str(f[EV.venueName]),
      address: str(f[EV.venueAddress]),
      location: str(f[EV.location]),
    },
    category: str(f[EV.category]),
    eventType: selName(f[EV.eventType]),
    timings: {
      registration: str(f[EV.registrationTime]),
      coachesBriefing: str(f[EV.coachesBriefingTime]),
      start: str(f[EV.eventStartTime]),
      end: str(f[EV.eventEndTime]),
    },
    participation: {
      girls: selName(f[EV.girlsParticipation]),
      boys: selName(f[EV.boysParticipation]),
      status: selName(f[EV.participationStatus]),
    },
    teamRuleDisplay: str(f[EV.teamRuleDisplay]),
    categoryNotes: str(f[EV.categoryNotes]),
    notes: str(f[EV.generalNotes]),
    source: {
      description: str(f[EV.sourceDescription]),
      url: str(f[EV.sourceUrl]),
    },
    displayOrder: num(f[EV.displayOrder]) ?? 0,
    active: f[EV.active] !== false,
    rules,
    legacyRulesFallback: legacySquad,
    gymnasticsRequirements: requirements,
  };
}

function sortEvents(events: any[]): any[] {
  const key = (e: any) => (e.date ? new Date(e.date).getTime() : Number.MAX_SAFE_INTEGER);
  return [...events].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka - kb;
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });
}

async function handleGet(url: URL) {
  const disciplineFilter = url.searchParams.get('discipline');
  const seasonFilter = url.searchParams.get('season');

  const [eventRecords, ruleRecords, requirementRecords] = await Promise.all([
    airtableFetch(EVENTS_TABLE_ID),
    airtableFetch(RULES_TABLE_ID),
    airtableFetch(REQUIREMENTS_TABLE_ID),
  ]);

  const rulesById = new Map(ruleRecords.map((r) => [r.id, toRulesShape(r)]));

  const requirementsByEventId = new Map<string, any[]>();
  for (const r of requirementRecords) {
    const shaped = toRequirementShape(r);
    const eventIds = linkIds((r.fields || {})[RQ.competitionEventLink]);
    for (const eid of eventIds) {
      if (!requirementsByEventId.has(eid)) requirementsByEventId.set(eid, []);
      requirementsByEventId.get(eid)!.push(shaped);
    }
  }

  let events = eventRecords
    .map((r) => toEventShape(r, rulesById, requirementsByEventId))
    .filter((e) => e.active);

  if (disciplineFilter) {
    events = events.filter((e) => e.discipline.toLowerCase() === disciplineFilter.toLowerCase());
  }
  if (seasonFilter) {
    events = events.filter((e) => e.season === seasonFilter);
  }

  events = sortEvents(events);

  return json({ events });
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method !== 'GET') return json({ error: 'Method not allowed — this endpoint is read-only' }, 405);
    const url = new URL(req.url);
    return await handleGet(url);
  } catch (e: any) {
    console.error('competitions function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
