/**
 * ResolutionManager
 *
 * Purpose:
 *   Mission 17 — Case Resolution Engine. Owns a case's solution.json,
 *   accepts a submitted Resolution Wizard report, validates and scores
 *   it (delegated to ResolutionValidator / ResolutionScorer), builds the
 *   final Case Summary (delegated to ResolutionReport), persists every
 *   attempt, and generates the Headquarters response mail.
 *
 * Responsibilities:
 *   - Load a case's solution.json
 *   - Gather validation context from ObjectiveManager, ForensicsManager,
 *     EvidenceManager, PeopleManager, MapManager, BoardManager
 *   - Submit → validate → score → build report → persist → respond
 *   - Mark the investigation completed (via ActiveInvestigationManager)
 *     on a Perfect/Successful outcome — nothing else ever locks
 *   - Track attempts, best score, and the last submission per case
 *
 * Storage key: 'resolution-state:{caseId}'
 *
 * Events emitted:
 *   investigation:submitted   { caseId }
 *   investigation:validated   { validation }
 *   investigation:completed   { outcome }         — Perfect/Successful only
 *   investigation:reopened    { caseId }
 *   resolution:generated      { report }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Never contain investigation-specific logic — every case supplies its
 *   own solution.json.
 */

import StorageManager             from './StorageManager.js';
import EventBus                    from '../core/EventBus.js';
import CaseManager                 from './CaseManager.js';
import ObjectiveManager            from './ObjectiveManager.js';
import ForensicsManager            from './ForensicsManager.js';
import EvidenceManager             from './EvidenceManager.js';
import PeopleManager               from './PeopleManager.js';
import MapManager                  from './MapManager.js';
import BoardManager                from './BoardManager.js';
import MailManager                 from './MailManager.js';
import ActiveInvestigationManager  from './ActiveInvestigationManager.js';
import { validateReport }          from '../core/resolution/ResolutionValidator.js';
import { scoreResolution }         from '../core/resolution/ResolutionScorer.js';
import { buildReport }             from '../core/resolution/ResolutionReport.js';

const CASE_BASE = './data/cases/';

const HQ_MESSAGES = {
    'Perfect Investigation':    { from: 'Captain Morgan', subject: 'Outstanding Work',       body: 'Excellent work, Detective. Every detail confirmed, every lead followed. This is exactly how a case should be closed. The suspect is being charged.' },
    'Successful Investigation': { from: 'Captain Morgan', subject: 'Case Closed',              body: 'Good work, Detective. Your conclusions are sound and the evidence supports the charge. The suspect is being charged.' },
    'Incomplete Investigation': { from: 'Captain Morgan', subject: 'Further Evidence Required', body: 'Further evidence is required before this case can be closed. Review the file and continue the investigation.' },
    'Incorrect Investigation':  { from: 'Captain Morgan', subject: 'Case Reviewed — Concerns',  body: 'The suspect cannot yet be charged. Several conclusions in this report do not match the evidence on file. Reconsider your theory.' },
    'Investigation Failed':     { from: 'Captain Morgan', subject: 'Investigation Closed',      body: 'The investigation has been closed. The report submitted does not hold up. This case remains open for reassignment — you may continue investigating.' },
};

class ResolutionManagerClass {

    constructor() {

        /** @type {string|null} */
        this._caseId = null;

        /** @type {Object|null} */
        this._solution = null;

        /** @type {Object[]} */
        this._attempts = [];

        /** @type {Object|null} */
        this._bestScore = null;

        /** @type {Object|null} */
        this._lastSubmission = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Loading
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        this.unloadCase();
        this._caseId = caseId;

        try {
            const res = await fetch( `${ CASE_BASE }${ caseId }/solution.json` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            this._solution = await res.json();
        }
        catch ( error ) {
            console.warn( `ResolutionManager: no solution.json for "${ caseId }" — Solve Investigation disabled.` );
            this._solution = null;
        }

        const saved = StorageManager.load( this._storageKey(), null );
        this._attempts       = saved?.attempts ?? [];
        this._bestScore       = saved?.bestScore ?? null;
        this._lastSubmission = saved?.lastSubmission ?? null;

    }

    /** @returns {void} */
    unloadCase() {
        this._caseId          = null;
        this._solution         = null;
        this._attempts         = [];
        this._bestScore        = null;
        this._lastSubmission  = null;
    }

    /** @returns {boolean} Whether this case has a solution to solve against. */
    hasSolution() {
        return this._solution !== null;
    }

    // ─────────────────────────────────────────────────────────────
    // Submission
    // ─────────────────────────────────────────────────────────────

    /**
     * Submit a Resolution Wizard report for validation and scoring.
     * Nothing about the investigation ever locks — an Incomplete or
     * Incorrect result simply returns recommendations and the player
     * may gather more information and submit again.
     *
     * @param {Object} report - { suspect, motive, weapon, location,
     *   timeline, evidence: string[], theoryIds: string[] }
     * @returns {{outcome:string, score:Object, report:Object, validation:Object}|null}
     */
    submit( report ) {

        if ( !this._solution || !this._caseId ) return null;

        EventBus.emit( 'investigation:submitted', { caseId: this._caseId } );

        const context = this._buildValidationContext();
        const fullReport = { ...report, victim: this._solution.victim };

        const validation = validateReport( fullReport, this._solution, context );
        EventBus.emit( 'investigation:validated', { validation } );

        const scoringContext = this._buildScoringContext( report, validation );
        const { outcome, score } = scoreResolution( validation, scoringContext );

        const finalReport = buildReport( {
            caseData:          CaseManager.getById( this._caseId ),
            report:            fullReport,
            validation,
            outcome,
            score,
            people:            this._peopleMap(),
            evidence:          this._evidenceMap(),
            locations:         this._locationMap(),
            forensicsResults:  this._forensicsResultMap(),
            theories:          this._theoriesFor( report.theoryIds ?? [] ),
            submittedAt:       Date.now(),
        } );

        this._recordAttempt( outcome, score, finalReport );
        this._sendHqResponse( outcome );

        if ( outcome === 'Perfect Investigation' || outcome === 'Successful Investigation' ) {
            ActiveInvestigationManager.complete();
            EventBus.emit( 'investigation:completed', { outcome } );
        }

        EventBus.emit( 'resolution:generated', { report: finalReport } );

        return { outcome, score, report: finalReport, validation };

    }

    /**
     * Return to the investigation after an Incomplete/Incorrect result.
     * Nothing was ever locked, so this is purely a signal for the UI —
     * the player can already keep investigating without calling this.
     *
     * @returns {void}
     */
    reopen() {
        if ( !this._caseId ) return;
        EventBus.emit( 'investigation:reopened', { caseId: this._caseId } );
    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /** @returns {Object|null} */
    getSolution() {
        return this._solution;
    }

    /** @returns {Object[]} */
    getAttempts() {
        return [ ...this._attempts ];
    }

    /** @returns {Object|null} */
    getBestScore() {
        return this._bestScore;
    }

    /** @returns {Object|null} */
    getLastSubmission() {
        return this._lastSubmission;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal — context gathering
    // ─────────────────────────────────────────────────────────────

    /** @returns {Object} */
    _buildValidationContext() {
        return {
            completedObjectiveIds:  ObjectiveManager.getCompletedObjectives().map( o => o.id ),
            collectedForensicsIds:  ForensicsManager.getByStatus( 'Collected' ).map( a => a.id ),
            currentPhaseId:         ObjectiveManager.getCurrentPhaseId(),
            phases:                 ObjectiveManager.getPhases(),
        };
    }

    /**
     * @param {Object} report
     * @param {Object} validation
     * @returns {Object}
     */
    _buildScoringContext( report, validation ) {

        const visible          = ObjectiveManager.getVisibleObjectives();
        const optionalObjectives = visible.filter( o => o.optional );

        const investigation = ActiveInvestigationManager.getActive();

        return {
            completionPercent:          ObjectiveManager.getProgress().progress,
            totalOptionalCount:          optionalObjectives.length,
            completedOptionalCount:      optionalObjectives.filter( o => o.status === 'completed' ).length,
            totalEvidenceCount:          EvidenceManager.getByCategory( 'all' ).length,
            submittedEvidenceCount:      ( report.evidence ?? [] ).length,
            totalRequiredEvidenceCount: ( this._solution.requiredEvidence ?? [] ).length,
            startedAt:                   investigation?.startedAt ?? Date.now(),
        };

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — lookups for report building
    // ─────────────────────────────────────────────────────────────

    /** @returns {Object} id -> person */
    _peopleMap() {
        const map = {};
        PeopleManager.getAll().forEach( p => { map[ p.id ] = p; } );
        return map;
    }

    /** @returns {Object} id -> evidence */
    _evidenceMap() {
        const map = {};
        EvidenceManager.getByCategory( 'all' ).forEach( e => { map[ e.id ] = e; } );
        return map;
    }

    /** @returns {Object} id -> location */
    _locationMap() {
        const map = {};
        MapManager.getAllLocations().forEach( l => { map[ l.id ] = l; } );
        return map;
    }

    /** @returns {Object} analysisId -> result summary string */
    _forensicsResultMap() {
        const map = {};
        ForensicsManager.getByStatus( 'Collected' ).forEach( a => {
            const result = ForensicsManager.getResult( a.id );
            map[ a.id ] = result ? `${ a.type }: ${ result.summary }` : a.type;
        } );
        return map;
    }

    /**
     * @param {string[]} theoryIds
     * @returns {Object[]}
     */
    _theoriesFor( theoryIds ) {
        return BoardManager.getNodes().filter( n => n.type === 'theory' && theoryIds.includes( n.id ) );
    }

    // ─────────────────────────────────────────────────────────────
    // Internal — persistence + HQ response
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string} outcome
     * @param {Object} score
     * @param {Object} report
     * @returns {void}
     */
    _recordAttempt( outcome, score, report ) {

        const attempt = { outcome, score, report, timestamp: Date.now() };
        this._attempts.push( attempt );
        this._lastSubmission = attempt;

        if ( !this._bestScore || _isBetter( score, outcome, this._bestScore ) ) {
            this._bestScore = { ...score, outcome };
        }

        this._persist();

    }

    /**
     * @param {string} outcome
     * @returns {void}
     */
    _sendHqResponse( outcome ) {

        const template = HQ_MESSAGES[ outcome ];
        const now = new Date();

        MailManager.injectMail( {
            id:        `mail-hq-${ this._caseId }-${ Date.now() }`,
            caseId:    this._caseId,
            from:      template.from,
            fromTitle: 'Precinct Captain',
            subject:   template.subject,
            date:      now.toISOString().slice( 0, 16 ).replace( 'T', ' ' ),
            priority:  'High',
            read:       false,
            starred:    false,
            folder:     'inbox',
            attachments: [],
            body:       template.body,
        } );

    }

    /**
     * Case 00 replay support — wipe this case's persisted resolution
     * attempt history so the next loadForCase() starts completely
     * fresh. Call before loadForCase().
     *
     * @param {string} caseId
     * @returns {void}
     */
    resetForCase( caseId ) {
        StorageManager.remove( `resolution-state:${ caseId }` );
    }

    /** @returns {string} */
    _storageKey() {
        return `resolution-state:${ this._caseId }`;
    }

    /** @returns {void} */
    _persist() {

        if ( !this._caseId ) return;

        StorageManager.save( this._storageKey(), {
            attempts:        this._attempts,
            bestScore:        this._bestScore,
            lastSubmission:  this._lastSubmission,
        } );

    }

}

/**
 * Whether `score`+`outcome` beats the current best — outcome tier first
 * (Perfect > Successful > Incomplete > Incorrect > Failed), completion
 * percent as the tiebreaker within the same tier.
 *
 * @param {Object} score
 * @param {string} outcome
 * @param {Object} currentBest
 * @returns {boolean}
 */
function _isBetter( score, outcome, currentBest ) {

    const tierRank = {
        'Perfect Investigation':    4,
        'Successful Investigation': 3,
        'Incomplete Investigation': 2,
        'Incorrect Investigation':  1,
        'Investigation Failed':     0,
    };

    const newRank   = tierRank[ outcome ] ?? 0;
    const bestRank  = tierRank[ currentBest.outcome ] ?? 0;

    if ( newRank !== bestRank ) return newRank > bestRank;
    return score.completionPercent >= currentBest.completionPercent;

}

// Singleton.
const ResolutionManager = new ResolutionManagerClass();

export default ResolutionManager;
