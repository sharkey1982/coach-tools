/* ============================================================================
   Coach Tools · Competitions function
   Shared, discipline-neutral read-only proxy over the Coach Tools Airtable
   base's competition architecture:

     Discipline
       -> Competition Events        (tbl3o1xE2FwUsiEgz)
       -> Competition Formats & Rules (tblpduCBZElIAmtBL, linked from Events)
       -> Gymnastics Competition Requirements (tblrHQY0tBQhvhPWr, linked from
          Events; gymnastics-only, empty array for other disciplines)

   This function is READ-ONLY — it never writes to Airtable.

   Field lookup is defensive by design: every field is looked up by BOTH its
   stable field ID and its display name (whichever the live Airtable REST
   response actually keys `fields` by), via the `get()` helper below, rather
   than assuming one keying scheme. This matters because the two reverse
   link fields on Competition Events (to Formats & Rules, and to Gymnastics
   Requirements) were auto-created by Airtable and aren't individually named
   in the project spec — those two are resolved by matching linked-record
   IDs against the id-sets of the already-fetched Rules/Requirements
   records, which works regardless of what that field happens to be called
   or keyed by.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT — same token used by every other Airtable-backed function
                    in this app (videos.mts, syllabus.mts, etc.)

   GET /.netlify/functions/competitions?discipline=Gymnastics&season=2026/27
     -> { events: CompetitionEvent[] }
     `discipline` (optional) — "Gymnastics" | "Football" | "Cricket" | "Athletics"
     `season` (optional)     — exact match against the Season text field, e.g. "2026/27"

     Events are filtered to Active !== false, then sorted by real Event Date
     ascending, with events that have no confirmed date (e.g. "May 2027 —
     date TBC") sorted after all dated events, Display Order as the
     tie-break.

     Every event carries its own `rules` (the linked Competition Formats &
     Rules record, normalized — or null if none linked) and, for Gymnastics
     events only, `gymnasticsRequirements` (linked requirement records,
     sorted by their own Display Order).

     Blank/unset fields are returned as `undefined`/`null` — never coerced
     to 0, false or an empty-but-present string. Formatting blanks as
     "TBC"/"Not specified" is a display concern, handled in
     shared/competitions-ui.js, not here.
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const EVENTS_TABLE_ID = 'tbl3o1xE2FwUsiEgz';
const RULES_TABLE_ID = 'tblpduCBZElIAmtBL';
const REQUIREMENTS_TABLE_ID = 'tblrHQY0tBQhvhPWr';

// Each field is described as [fieldId, displayName] — get() below tries
// both, so a lookup succeeds whether the live API keys `fields` by ID or
// by name.
type F = [string, string];

const EV = {
  eventName: ['fldApNjXceH9W9sYQ', 'Event Name'] as F,
  eventId: ['fld8EKYmnveDlzmQ0', 'Event ID'] as F,
  discipline: ['fldtn6Q3T0LdQDim2', 'Discipline'] as F,
  governingBody: ['fldC0ttGzjaFwmcA5', 'Governing Body'] as F,
  competitionName: ['fld6Zunqxq51ikqHa', 'Competition Name'] as F,
  season: ['fld3uhdO4Om6JkmvP', 'Season'] as F,
  eventDate: ['fld1tDOz9BI2aMstd', 'Event Date'] as F,
  dateDisplay: ['fldRTCqtAZ5XwuGWL', 'Date Display'] as F,
  dateStatus: ['fldm0ZplFPzURhvQN', 'Date Status'] as F,
  location: ['fld4XTNqkIONCV1Pl', 'Location'] as F,
  venueName: ['fldBXG00gYJE38dXg', 'Venue Name'] as F,
  venueAddress: ['fldfF5IIdbVsJl84E', 'Venue Address'] as F,
  category: ['fldb7eKo6G3JNw6DV', 'Age / Category'] as F,
  eventType: ['fldRwyJVJwKUmRhAp', 'Event Type'] as F,
  registrationTime: ['fldoFkmTD2vFRI41i', 'Registration Time'] as F,
  coachesBriefingTime: ['fldQLp33liroMKlWA', 'Coaches Briefing Time'] as F,
  eventStartTime: ['fldf5uSdtRKNr8RTJ', 'Event Start Time'] as F,
  eventEndTime: ['flduVR2zpIkfTVlFx', 'Event End Time'] as F,
  girlsParticipation: ['fld1CIdjpkfLFXoSL', 'Girls Participation'] as F,
  boysParticipation: ['fldupQgP1HNQWPyZI', 'Boys Participation'] as F,
  teamRuleDisplay: ['flde4mLHNY2tMzyfx', 'Team Rule Display'] as F,
  categoryNotes: ['fldDu2FrpDRSQV1Rm', 'Category Notes'] as F,
  generalNotes: ['fldE8KFwx24Sp5oSD', 'General Notes'] as F,
  participationStatus: ['fldn7qEFB270yNhRJ', 'Participation Status'] as F,
  sourceUrl: ['fldBStsELJ2skeT7L', 'Source URL'] as F,
  sourceDescription: ['fldn8YizEmSO9AJ8I', 'Source Description'] as F,
  active: ['fldMjxswldzatQlmf', 'Active'] as F,
  displayOrder: ['fldu3omyqaLACZZmg', 'Display Order'] as F,
  legacyFormat: ['fldf9UX1OAjuLHGSZ', 'Format'] as F,
  legacyMinTeamSize: ['flducZGU0dRZjLTnS', 'Minimum Team Size'] as F,
  legacyMaxSquadSize: ['fldTK3fiOlcEJh2Xj', 'Maximum Squad Size'] as F,
  legacyCompetitorsPerPiece: ['fldDzSvlDqr54OmVu', 'Competitors Per Piece'] as F,
  legacyCountingScores: ['fldvtCOixxINCmSep', 'Counting Scores'] as F,
  // Reverse-link fields (auto-created by Airtable; unnamed in the spec) —
  // resolved by ID-set matching in toEventShape(), not looked up by key.
  rulesLinkId: 'fldcr14z52SEr6Rpb',
  requirementsLinkId: 'fldJohnGYjCJncYF8',
};

const RU = {
  ruleSetName: ['fldHIo8P11DM210yu', 'Rule Set Name'] as F,
  competitionEventLink: ['fldv5l6Sn7bN3mlac', 'Competition Event'] as F,
  discipline: ['fld6GwJ9B64zTuR9i', 'Discipline'] as F,
  category: ['fld0Ca4yaaGVx6z1j', 'Age / Category'] as F,
  status: ['fldIrHQIIF0HLkTrD', 'Rule Status'] as F,
  maxSquadSize: ['fldeUpxs9t7liFaBT', 'Maximum Squad Size'] as F,
  minTeamSize: ['fldrpu20bZrHnigRm', 'Minimum Team Size'] as F,
  competitorsPerPiece: ['fldqvRZK9p8RZ2gfH', 'Competitors per Piece'] as F,
  countingScores: ['fldnlaO8GCSrK7RyQ', 'Counting Scores'] as F,
  sourceReference: ['fldcoz29svuaYbODw', 'Source Reference'] as F,
  ruleNotes: ['fldtJrMVPtkaVlZpO', 'Rule Notes'] as F,
  unknownNotes: ['fld7FOPQU0XILCBdz', 'Unknown / TBC Notes'] as F,
  active: ['fldU6RLOzH26Fcb8V', 'Active'] as F,
  playersOnPitch: ['fldVrFY8htIZEJUuP', 'Players on Pitch'] as F,
  matchDurationMinutes: ['fldJcCw9iP9355zE6', 'Match Duration Minutes'] as F,
  breakMinutes: ['fldO3oQVWM9ncnAYU', 'Break Minutes'] as F,
  surface: ['flddDy1qycX1a812A', 'Surface'] as F,
  ballSize: ['fldyJwzVere1H23QQ', 'Ball Size'] as F,
  competitionStructure: ['fldFVJO0LmxZR5oXz', 'Competition Structure'] as F,
  substitutionType: ['fldl5Uu5VpDinnzzs', 'Substitution Type'] as F,
  unlimitedSubstitutions: ['fld5AiIrSViKwvJKy', 'Unlimited Substitutions'] as F,
  offside: ['fldjhu4ZHKLWUirDN', 'Offside'] as F,
  restartDistanceYards: ['fldFr70QLRFHkNCOl', 'Restart Distance Yards'] as F,
  standardLawsApply: ['fldArRckRRQmj5Tlb', 'Standard Laws Apply'] as F,
  winPoints: ['fldLMx53BwECN5uOy', 'Win Points'] as F,
  drawPoints: ['fldVsmYEVMowgyZFv', 'Draw Points'] as F,
  lossPoints: ['fldxKW96JwVUojXdx', 'Loss Points'] as F,
  tieBreakOrder: ['fldI1FNjrHX9Mnd3L', 'Tie-break Order'] as F,
  extraTimeMinutes: ['fld5mXs5FbH0RLl8d', 'Extra Time Minutes'] as F,
  penaltyShootoutFormat: ['fldNO6wnn2M7ImylS', 'Penalty Shootout Format'] as F,
  penaltyEligibility: ['fldLsX6rnKIkWbn19', 'Penalty Eligibility'] as F,
  equipmentRequirements: ['fldnCwU1fbZQPUOR9', 'Equipment Requirements'] as F,
  schoolYearEligibility: ['fldzDt0VBXrPPyKq5', 'School-Year Eligibility'] as F,
  genderComposition: ['fldFcnxMt8h1EebZA', 'Gender Composition'] as F,
  pitchLengthMetres: ['fldksuOqKcqoegmqz', 'Pitch Length Metres'] as F,
  pitchWidthMetres: ['fldr3KRKQPc4yEAKf', 'Pitch Width Metres'] as F,
  goalWidthMetres: ['fldXnZcjIFgK44kap', 'Goal Width Metres'] as F,
  goalHeightMetres: ['fldLiHtLs00K0jjVb', 'Goal Height Metres'] as F,
  penaltyAreaDimensions: ['fld3ksgM7cZ0UMOGQ', 'Penalty-area Dimensions'] as F,
  penaltyDistance: ['fldIok7MqWZIImgEA', 'Penalty Distance'] as F,
  goalkeeperDistributionRules: ['fldkGpn0LTRNTYdLN', 'Goalkeeper Distribution Rules'] as F,
  retreatLineRules: ['fld9kPkyQ5SjjPa7P', 'Retreat-line Rules'] as F,
};

const RQ = {
  requirementName: ['fldhfePlS6sErlQ5l', 'Requirement Name'] as F,
  competitionEventLink: ['fldyxUD7m0OzlWpyV', 'Competition Event'] as F,
  gender: ['fld3pIYmQsq3m7yNb', 'Gender'] as F,
  piece: ['fldAxaUdvwHzO8FjN', 'Piece'] as F,
  required: ['fld5LsXiW6ARsox46', 'Required'] as F,
  musicRequirement: ['fldd0EtBne5uXFvD2', 'Music Requirement'] as F,
  requirementNotes: ['fldVA6VMDyfeVGH7L', 'Requirement Notes'] as F,
  displayOrder: ['fldunwlNdj4yvYcYJ', 'Display Order'] as F,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Tries the field ID first, then the display name — works whichever way
// the live Airtable response happens to key `fields`.
function get(fields: any, desc: F): any {
  if (!fields) return undefined;
  const [id, name] = desc;
  if (fields[id] !== undefined) return fields[id];
  if (fields[name] !== undefined) return fields[name];
  return undefined;
}

async function airtableFetch(tableId: string): Promise<any[]> {
  const pat = Netlify.env.get('AIRTABLE_PAT');
  if (!pat) throw new Error('AIRTABLE_PAT not configured');
  const base = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?returnFieldsByFieldId=true`;
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

function selName(v: any): string | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map((x) => x?.name).filter(Boolean).join(', ') || undefined;
  if (typeof v === 'string') return v; // in case a select ever comes through as a bare string
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

function linkIds(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
}

// Finds whichever field on a record holds an array of linked-record
// references where at least one referenced id is a member of
// `targetIds` — used for the two reverse-link fields on Events that
// aren't individually named in the spec. Robust regardless of what that
// field is actually called or keyed by.
function findLinkByTarget(fields: any, targetIds: Set<string>): string[] {
  if (!fields) return [];
  for (const v of Object.values(fields)) {
    if (Array.isArray(v) && v.length) {
      const ids = v.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
      if (ids.some((id: string) => targetIds.has(id))) return ids;
    }
  }
  return [];
}

function offsideText(v: string | undefined): string | undefined {
  if (v === 'No') return 'No offside';
  if (v === 'Yes') return 'Offside applies';
  return undefined;
}

function toRequirementShape(record: any) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: str(get(f, RQ.requirementName)),
    gender: selName(get(f, RQ.gender)),
    piece: selName(get(f, RQ.piece)),
    required: bool(get(f, RQ.required)),
    musicRequirement: selName(get(f, RQ.musicRequirement)),
    notes: str(get(f, RQ.requirementNotes)),
    displayOrder: num(get(f, RQ.displayOrder)),
  };
}

function toRulesShape(record: any) {
  const f = record.fields || {};
  const discipline = selName(get(f, RU.discipline));
  const shared = {
    id: record.id,
    ruleSetName: str(get(f, RU.ruleSetName)),
    discipline,
    category: str(get(f, RU.category)),
    status: selName(get(f, RU.status)),
    squad: {
      maximumSquadSize: num(get(f, RU.maxSquadSize)),
      minimumTeamSize: num(get(f, RU.minTeamSize)),
      competitorsPerPiece: num(get(f, RU.competitorsPerPiece)),
      countingScores: num(get(f, RU.countingScores)),
    },
    sourceReference: str(get(f, RU.sourceReference)),
    ruleNotes: str(get(f, RU.ruleNotes)),
    unknownNotes: str(get(f, RU.unknownNotes)),
    active: get(f, RU.active) !== false,
  };

  if (discipline !== 'Football') return { ...shared, football: undefined };

  const offside = selName(get(f, RU.offside));
  const unlimitedSubs = bool(get(f, RU.unlimitedSubstitutions));
  const standardLaws = bool(get(f, RU.standardLawsApply));

  return {
    ...shared,
    football: {
      playersOnPitch: num(get(f, RU.playersOnPitch)),
      matchDurationMinutes: num(get(f, RU.matchDurationMinutes)),
      breakMinutes: num(get(f, RU.breakMinutes)),
      surface: str(get(f, RU.surface)),
      ballSize: num(get(f, RU.ballSize)),
      competitionStructure: str(get(f, RU.competitionStructure)),
      substitutionType: str(get(f, RU.substitutionType)),
      unlimitedSubstitutions: unlimitedSubs,
      unlimitedSubstitutionsText: unlimitedSubs === true
        ? 'Unlimited roll-on/roll-off substitutions'
        : unlimitedSubs === false ? 'Limited substitutions' : undefined,
      offside,
      offsideText: offsideText(offside),
      restartDistanceYards: num(get(f, RU.restartDistanceYards)),
      standardLawsApply: standardLaws,
      standardLawsApplyText: standardLaws === true
        ? 'Normal Laws of the Game apply except where amended by the tournament rules'
        : undefined,
      points: {
        win: num(get(f, RU.winPoints)),
        draw: num(get(f, RU.drawPoints)),
        loss: num(get(f, RU.lossPoints)),
      },
      tieBreakOrder: str(get(f, RU.tieBreakOrder)),
      extraTimeMinutes: num(get(f, RU.extraTimeMinutes)),
      penaltyShootoutFormat: str(get(f, RU.penaltyShootoutFormat)),
      penaltyEligibility: str(get(f, RU.penaltyEligibility)),
      equipmentRequirements: str(get(f, RU.equipmentRequirements)),
      schoolYearEligibility: str(get(f, RU.schoolYearEligibility)),
      genderComposition: str(get(f, RU.genderComposition)),
      pitch: {
        lengthMetres: num(get(f, RU.pitchLengthMetres)),
        widthMetres: num(get(f, RU.pitchWidthMetres)),
      },
      goal: {
        widthMetres: num(get(f, RU.goalWidthMetres)),
        heightMetres: num(get(f, RU.goalHeightMetres)),
      },
      penaltyAreaDimensions: str(get(f, RU.penaltyAreaDimensions)),
      penaltyDistance: str(get(f, RU.penaltyDistance)),
      goalkeeperDistributionRules: str(get(f, RU.goalkeeperDistributionRules)),
      retreatLineRules: str(get(f, RU.retreatLineRules)),
    },
  };
}

function toEventShape(
  record: any,
  rulesById: Map<string, any>,
  ruleRecordIds: Set<string>,
  requirementsByEventId: Map<string, any[]>,
  requirementRecordIds: Set<string>,
) {
  const f = record.fields || {};
  const discipline = selName(get(f, EV.discipline)) || '';

  const ruleIds = findLinkByTarget(f, ruleRecordIds);
  const rules = ruleIds.length ? (rulesById.get(ruleIds[0]) || null) : null;

  const legacySquad = !rules ? {
    maximumSquadSize: num(get(f, EV.legacyMaxSquadSize)),
    minimumTeamSize: num(get(f, EV.legacyMinTeamSize)),
    competitorsPerPiece: num(get(f, EV.legacyCompetitorsPerPiece)),
    countingScores: num(get(f, EV.legacyCountingScores)),
  } : undefined;

  const reqIds = findLinkByTarget(f, requirementRecordIds);
  const requirements = discipline === 'Gymnastics'
    ? reqIds
        .map((id) => requirementsByEventId.get(id))
        .filter(Boolean)
        .flat()
        .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    : undefined;

  return {
    id: record.id,
    eventId: str(get(f, EV.eventId)),
    discipline,
    governingBody: selName(get(f, EV.governingBody)),
    competitionName: str(get(f, EV.competitionName)),
    eventName: str(get(f, EV.eventName)) || '',
    season: str(get(f, EV.season)),
    date: str(get(f, EV.eventDate)),
    dateDisplay: str(get(f, EV.dateDisplay)),
    dateStatus: selName(get(f, EV.dateStatus)),
    venue: {
      name: str(get(f, EV.venueName)),
      address: str(get(f, EV.venueAddress)),
      location: str(get(f, EV.location)),
    },
    category: str(get(f, EV.category)),
    eventType: selName(get(f, EV.eventType)),
    timings: {
      registration: str(get(f, EV.registrationTime)),
      coachesBriefing: str(get(f, EV.coachesBriefingTime)),
      start: str(get(f, EV.eventStartTime)),
      end: str(get(f, EV.eventEndTime)),
    },
    participation: {
      girls: selName(get(f, EV.girlsParticipation)),
      boys: selName(get(f, EV.boysParticipation)),
      status: selName(get(f, EV.participationStatus)),
    },
    teamRuleDisplay: str(get(f, EV.teamRuleDisplay)),
    categoryNotes: str(get(f, EV.categoryNotes)),
    notes: str(get(f, EV.generalNotes)),
    source: {
      description: str(get(f, EV.sourceDescription)),
      url: str(get(f, EV.sourceUrl)),
    },
    displayOrder: num(get(f, EV.displayOrder)) ?? 0,
    active: get(f, EV.active) !== false,
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
  const debug = url.searchParams.get('debug') === '1';

  const [eventRecords, ruleRecords, requirementRecords] = await Promise.all([
    airtableFetch(EVENTS_TABLE_ID),
    airtableFetch(RULES_TABLE_ID),
    airtableFetch(REQUIREMENTS_TABLE_ID),
  ]);

  const rulesById = new Map(ruleRecords.map((r) => [r.id, toRulesShape(r)]));
  const ruleRecordIds = new Set(ruleRecords.map((r) => r.id));
  const requirementRecordIds = new Set(requirementRecords.map((r) => r.id));

  const requirementsByEventId = new Map<string, any[]>();
  for (const r of requirementRecords) {
    const shaped = toRequirementShape(r);
    const eventIds = linkIds(get(r.fields || {}, RQ.competitionEventLink));
    for (const eid of eventIds) {
      if (!requirementsByEventId.has(eid)) requirementsByEventId.set(eid, []);
      requirementsByEventId.get(eid)!.push(shaped);
    }
  }

  let events = eventRecords
    .map((r) => toEventShape(r, rulesById, ruleRecordIds, requirementsByEventId, requirementRecordIds))
    .filter((e) => e.active);

  if (disciplineFilter) {
    events = events.filter((e) => e.discipline.toLowerCase() === disciplineFilter.toLowerCase());
  }
  if (seasonFilter) {
    events = events.filter((e) => e.season === seasonFilter);
  }

  events = sortEvents(events);

  if (debug) {
    return json({
      events,
      _debug: {
        rawEventCount: eventRecords.length,
        rawRuleCount: ruleRecords.length,
        rawRequirementCount: requirementRecords.length,
        firstEventFieldKeys: eventRecords[0] ? Object.keys(eventRecords[0].fields || {}) : [],
        firstEventDisciplineRaw: eventRecords[0] ? get(eventRecords[0].fields, EV.discipline) : null,
      },
    });
  }

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
