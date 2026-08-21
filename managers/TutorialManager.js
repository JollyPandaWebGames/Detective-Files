/**
 * TutorialManager
 *
 * Purpose:
 *   Reusable, data-driven, mentor-guided tutorial engine. Case 00 is
 *   its first (and currently only) consumer, but the engine itself
 *   knows nothing case-00-specific — every dialogue line, required
 *   action, and highlight target comes from a JSON file (see
 *   data/tutorial/case-00-dialogue.json and docs/TUTORIAL_SYSTEM.md).
 *
 * Responsibilities:
 *   - Load a tutorial's dialogue JSON and step through its node graph
 *   - Lock the game world while a dialogue/instruction is active —
 *     block clicks/keys on everything except the tutorial UI and
 *     (during an instruction) the highlighted target element
 *   - Delegate rendering to TutorialDialog and TutorialHighlight
 *   - Detect the required action for an instruction node by listening
 *     for the real gameplay EventBus event it names, then advance
 *   - Always start fresh from the first node. Design decision (v2.0.4):
 *     earlier versions tried to persist and resume tutorial progress
 *     across an interruption (page reload, etc.), matching EPIC Part
 *     11. In practice this required the tutorial's own saved node and
 *     the real game state (objectives, evidence notes, mail read-state)
 *     to reattach in perfect lockstep after every possible interruption
 *     point, and repeatedly didn't — see the v2.0.2/v2.0.3 bugfix notes
 *     in docs/TUTORIAL_SYSTEM.md §7 for two different ways that broke.
 *     Per direct product decision, Case 00 now has NO continue/resume
 *     capability anywhere in the stack: ActiveInvestigationManager
 *     never re-affirms it as the active investigation across a reload
 *     (see its initialize()), Case Management never offers a "Continue
 *     Investigation" button for it (see apps/case-management), and this
 *     class never asks to resume — every start is the one and only run
 *     that exists. Progress is still persisted (see StorageManager
 *     calls below) purely for debugging/analytics; nothing reads it
 *     back to decide where to resume.
 *
 * Node types (from the dialogue JSON):
 *   "dialogue"    — a mentor line with a Continue button
 *   "instruction" — a short banner + highlighted target; advances
 *                   only when the named `requiredAction` event fires
 *
 * Rules:
 *   TutorialManager never hardcodes dialogue text — see PART 4 of the
 *   spec and docs/TUTORIAL_SYSTEM.md. It never reaches into an
 *   application's internals; it only listens for events those
 *   applications already emit on EventBus. It never touches
 *   localStorage directly — all persistence goes through
 *   StorageManager, per project rules.
 *
 * Events emitted:
 *   tutorial:started    { caseId }
 *   tutorial:locked      {}
 *   tutorial:unlocked    {}
 *   tutorial:completed  { caseId }
 *   tutorial:skipped    { caseId }
 *
 * Dependencies:
 *   EventBus, TutorialDialog, TutorialHighlight, CaseManager,
 *   ApplicationManager, ActiveInvestigationManager, MailManager,
 *   ForensicsManager, StorageManager
 */

import EventBus                    from '../core/EventBus.js';
import TutorialDialog              from '../ui/TutorialDialog.js';
import TutorialHighlight           from '../ui/TutorialHighlight.js';
import CaseManager                 from './CaseManager.js';
import ApplicationManager          from './ApplicationManager.js';
import ActiveInvestigationManager  from './ActiveInvestigationManager.js';
import MailManager                 from './MailManager.js';
import ForensicsManager            from './ForensicsManager.js';
import ObjectiveManager            from './ObjectiveManager.js';
import StorageManager              from './StorageManager.js';

const DIALOGUE_URL = './data/tutorial/case-00-dialogue.json';
const TUTORIAL_CASE_ID = 'case-00';
const PROGRESS_STORAGE_KEY = 'tutorial:case-00:progress';

// DOM/keyboard event types intercepted while the tutorial is locked.
const INTERCEPTED_EVENTS = [ 'click', 'pointerdown', 'mousedown', 'keydown', 'touchstart' ];

/**
 * Tutorial State Machine (EPIC Part 10).
 *
 * These are presentation-layer labels over the same node/phase graph
 * driven by the dialogue JSON — TutorialManager doesn't run a second,
 * parallel state engine. Each dialogue node's `phase` field maps to
 * exactly one of these via PHASE_TO_STATE below, so `getState()` is
 * always in sync with whatever node is actually on screen.
 */
export const TUTORIAL_STATES = Object.freeze( {
    NOT_STARTED:                'NOT_STARTED',
    INTRODUCTION:                'INTRODUCTION',
    DESKTOP_TRAINING:            'DESKTOP_TRAINING',
    CASE_MANAGEMENT_TRAINING:    'CASE_MANAGEMENT_TRAINING',
    ACTIVE_CASE_TRAINING:        'ACTIVE_CASE_TRAINING',
    MAIL_TRAINING:                'MAIL_TRAINING',
    EVIDENCE_TRAINING:            'EVIDENCE_TRAINING',
    MAP_TRAINING:                'MAP_TRAINING',
    MESSENGER_TRAINING:        'MESSENGER_TRAINING',
    CCTV_TRAINING:                'CCTV_TRAINING',
    FORENSICS_TRAINING:        'FORENSICS_TRAINING',
    DATABASE_TRAINING:            'DATABASE_TRAINING',
    BOARD_TRAINING:                'BOARD_TRAINING',
    SOLVING_TRAINING:            'SOLVING_TRAINING',
    COMPLETED:                    'COMPLETED',
    PAUSED:                        'PAUSED',
} );

// Dialogue-JSON `phase` string -> TUTORIAL_STATES value.
const PHASE_TO_STATE = {
    'welcome':                TUTORIAL_STATES.INTRODUCTION,
    'desktop':                TUTORIAL_STATES.DESKTOP_TRAINING,
    'case-management':        TUTORIAL_STATES.CASE_MANAGEMENT_TRAINING,
    'active-investigation':    TUTORIAL_STATES.ACTIVE_CASE_TRAINING,
    'police-mail':            TUTORIAL_STATES.MAIL_TRAINING,
    'evidence':                TUTORIAL_STATES.EVIDENCE_TRAINING,
    'city-map':                TUTORIAL_STATES.MAP_TRAINING,
    'messenger':                TUTORIAL_STATES.MESSENGER_TRAINING,
    'cctv':                    TUTORIAL_STATES.CCTV_TRAINING,
    'forensics':                TUTORIAL_STATES.FORENSICS_TRAINING,
    'criminal-database':        TUTORIAL_STATES.DATABASE_TRAINING,
    'board':                    TUTORIAL_STATES.BOARD_TRAINING,
    'solving':                    TUTORIAL_STATES.SOLVING_TRAINING,
};

class TutorialManagerClass {

    constructor() {

        /** @type {boolean} */
        this._loaded = false;

        /** @type {Object|null} Parsed dialogue JSON */
        this._data = null;

        /** @type {Map<string, Object>} */
        this._nodesById = new Map();

        /** @type {boolean} Tutorial dialogue sequence is running */
        this._active = false;

        /** @type {boolean} Game world is currently locked */
        this._locked = false;

        /** @type {Object|null} Current node */
        this._current = null;

        /** @type {Function} Bound document-level interceptor */
        this._interceptor = this._handleIntercept.bind( this );

        /** @type {Function} Bound generic EventBus listener for required actions */
        this._onRequiredActionEvent = null;

        /** @type {Set<string>} Every distinct event name any node's requiredAction listens for */
        this._watchedEvents = new Set();

        /** @type {string} Current TUTORIAL_STATES value — see PHASE_TO_STATE */
        this._state = TUTORIAL_STATES.NOT_STARTED;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Load the tutorial dialogue data and wire up the triggers that
     * start/replay it. Safe to call once at boot.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        await this._loadDialogue();

        // Case 00 is always a tutorial (EPIC Part 8) — every fresh
        // investigation start on it replays from the top. There is no
        // resume path (v2.0.4 — see the class doc), so this is the only
        // condition that matters: has a new investigationStarted for
        // Case 00 arrived while we weren't already mid-sequence?
        EventBus.on( 'investigationStarted', ( { investigation } ) => {

            if ( !investigation || investigation.caseId !== TUTORIAL_CASE_ID ) return;
            if ( this._active ) return; // already mid-sequence — the instruction handler advances it

            this.start();

        } );

        // First-run: player has never touched Case 00 at all. There's
        // nothing to resume here either (ActiveInvestigationManager
        // never re-affirms Case 00 across a reload — see its
        // initialize()), so this only ever fires for a genuinely
        // untouched case.
        EventBus.on( 'workstation:ready', () => {

            const tutorialCase = CaseManager.getById( TUTORIAL_CASE_ID );
            if ( tutorialCase && tutorialCase.status === 'Unlocked' ) {
                this.start();
            }

        } );

    }

    /**
     * Fetch and index the dialogue JSON.
     *
     * @returns {Promise<void>}
     */
    async _loadDialogue() {

        if ( this._loaded ) return;

        try {

            const res = await fetch( DIALOGUE_URL );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );

            this._data = await res.json();
            this._nodesById.clear();

            for ( const node of this._data.nodes ) {
                this._nodesById.set( node.id, node );
                if ( node.requiredAction?.event ) {
                    this._watchedEvents.add( node.requiredAction.event );
                }
            }

            this._loaded = true;

        } catch ( error ) {
            console.error( 'TutorialManager: Failed to load dialogue data.', error );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * (Re)start the tutorial from the first node. No resume path (see
     * the class doc, v2.0.4) — every call is a fresh run.
     *
     * @returns {void}
     */
    start() {

        if ( !this._data || this._data.nodes.length === 0 ) return;

        this._active = true;
        this._injectStylesheet();
        this._bindRequiredActionListener();

        EventBus.emit( 'tutorial:started', { caseId: TUTORIAL_CASE_ID } );
        this._goTo( this._data.nodes[ 0 ].id );

    }

    /**
     * Whether the tutorial sequence is currently running.
     *
     * @returns {boolean}
     */
    isActive() {
        return this._active;
    }

    /**
     * Whether the game world is currently locked by the tutorial.
     *
     * @returns {boolean}
     */
    isLocked() {
        return this._locked;
    }

    /**
     * The current TUTORIAL_STATES value (EPIC Part 10).
     *
     * @returns {string}
     */
    getState() {
        return this._state;
    }

    /**
     * The lesson number (1-18, EPIC Part 9) of the node currently on
     * screen, or null if the tutorial isn't active.
     *
     * @returns {number|null}
     */
    getCurrentLessonId() {
        return this._current?.lesson ?? null;
    }

    // ─────────────────────────────────────────────────────────────
    // Sequencing
    // ─────────────────────────────────────────────────────────────

    /**
     * Render the node with the given id and lock/unlock accordingly.
     *
     * @param {string|null} nodeId
     * @returns {void}
     */
    _goTo( nodeId ) {

        if ( !nodeId ) {
            this._finish();
            return;
        }

        const node = this._nodesById.get( nodeId );
        if ( !node ) {
            console.warn( `TutorialManager: Unknown dialogue node "${ nodeId }".` );
            this._finish();
            return;
        }

        this._current = node;
        this._state   = PHASE_TO_STATE[ node.phase ] ?? this._state;
        this._lock();

        // Persisted purely for debugging/analytics (see class doc,
        // v2.0.4) — nothing reads this back to resume anything.
        // EPIC Part 19 fields: tutorialState/currentLessonId/currentDialogueId
        // live here; activeInvestigationId and completedObjectives are NOT
        // duplicated here — InvestigationSession/ObjectiveManager already
        // own those (EPIC Part 13), and TutorialManager only guides.
        StorageManager.save( PROGRESS_STORAGE_KEY, {
            nodeId:            node.id,
            status:            'in-progress',
            tutorialCaseId:    TUTORIAL_CASE_ID,
            tutorialState:    this._state,
            currentLessonId:    node.lesson ?? null,
            currentDialogueId: node.id,
        } );

        // Bug fix (v1.1.1): an instruction step must not wait forever for
        // an event that already happened before we got here — e.g. the
        // player already had Police Mail open (singleton apps only emit
        // 'app:opened' on the FIRST open, not on refocus), or is replaying
        // Case 00 after already reading that mail / submitting that
        // analysis in a prior playthrough. Check first; only fall back to
        // listening for the live event if the condition isn't already true.
        if ( node.type === 'instruction' && this._isAlreadySatisfied( node ) ) {
            this._advance();
            return;
        }

        if ( node.type === 'dialogue' ) {

            TutorialHighlight.hide();
            TutorialDialog.showDialogue(
                { speakers: this._data.speakers, activeSpeaker: node.speaker, text: node.text },
                {
                    onContinue: () => this._goTo( node.next ),
                    onSkip:     () => this._skip(),
                }
            );

        } else if ( node.type === 'instruction' ) {

            // The dialogue box closes temporarily; the relevant UI is
            // highlighted and a short instruction banner is shown —
            // EPIC Part 3/6. The player must perform the real action;
            // there is no Continue button here by design. A "Need
            // Help?" control and a permanently-available Skip Tutorial
            // control are always shown alongside it (EPIC Part 11/12)
            // so the player is never left with no way forward if the
            // required action or highlight target never resolves.
            this._showInstructionNode( node );

        }

    }

    /**
     * Advance past the current instruction node once its required
     * action has genuinely happened.
     *
     * @returns {void}
     */
    _advance() {

        if ( !this._current ) return;
        this._goTo( this._current.next );

    }

    /**
     * Render an instruction node's highlight + banner, wired up with
     * a "Need Help?" control (re-explains the step and re-resolves
     * the highlight target — recovers from a target that momentarily
     * wasn't in the DOM, e.g. a window that was closed and reopened)
     * and an always-visible Skip Tutorial control, so an instruction
     * step can never leave the player with no way forward (EPIC Part
     * 11/14).
     *
     * @param {Object} node
     * @returns {void}
     */
    _showInstructionNode( node ) {

        if ( node.highlightTarget ) {
            TutorialHighlight.show( node.highlightTarget, node.highlightScope ?? null );
        } else {
            TutorialHighlight.hide();
        }

        TutorialDialog.showInstruction( node.text, {
            onHint: () => this._showHint( node ),
            onSkip: () => this._skip(),
        } );

    }

    /**
     * Show a brief mentor explanation of the current instruction step,
     * then return to it. Never advances or completes the objective —
     * it only re-explains and re-attempts to resolve/highlight the
     * target (EPIC Part 12).
     *
     * @param {Object} node
     * @returns {void}
     */
    _showHint( node ) {

        const hintText = node.hint ?? node.text;

        TutorialDialog.showDialogue(
            { speakers: this._data.speakers, activeSpeaker: node.hintSpeaker ?? node.speaker ?? 'female-detective', text: hintText },
            {
                onContinue: () => {
                    if ( this._current !== node ) return; // node changed while hint was open
                    this._showInstructionNode( node );
                },
            }
        );

    }

    /**
     * End the tutorial sequence normally (reached the last node).
     *
     * @returns {void}
     */
    _finish() {

        this._active  = false;
        this._current = null;
        this._state   = TUTORIAL_STATES.COMPLETED;
        this._unlock();
        TutorialDialog.hide();
        TutorialHighlight.hide();
        this._unbindRequiredActionListener();

        // Completed — persisted purely for debugging (see class doc);
        // nothing reads this back to decide anything.
        StorageManager.save( PROGRESS_STORAGE_KEY, {
            nodeId: null, status: 'completed', tutorialCaseId: TUTORIAL_CASE_ID,
            tutorialState: this._state, currentLessonId: null, currentDialogueId: null,
        } );

        EventBus.emit( 'tutorial:completed', { caseId: TUTORIAL_CASE_ID } );

    }

    /**
     * End the tutorial sequence early via the skip control.
     *
     * @returns {void}
     */
    _skip() {

        this._active  = false;
        this._current = null;
        this._state   = TUTORIAL_STATES.NOT_STARTED;
        this._unlock();
        TutorialDialog.hide();
        TutorialHighlight.hide();
        this._unbindRequiredActionListener();

        // Skipped — persisted purely for debugging (see class doc);
        // nothing reads this back to decide anything.
        StorageManager.save( PROGRESS_STORAGE_KEY, {
            nodeId: null, status: 'skipped', tutorialCaseId: TUTORIAL_CASE_ID,
            tutorialState: this._state, currentLessonId: null, currentDialogueId: null,
        } );

        EventBus.emit( 'tutorial:skipped', { caseId: TUTORIAL_CASE_ID } );

    }

    // ─────────────────────────────────────────────────────────────
    // Required Action Detection
    // ─────────────────────────────────────────────────────────────

    /**
     * Subscribe once to every event name referenced by any node's
     * requiredAction, so we can match against whichever one fires.
     *
     * @returns {void}
     */
    _bindRequiredActionListener() {

        if ( this._onRequiredActionEvent ) return;

        this._onRequiredActionEvent = ( eventName, payload ) => {

            if ( !this._current || this._current.type !== 'instruction' ) return;

            const required = this._current.requiredAction;
            if ( !required || required.event !== eventName ) return;
            if ( !this._matchesPayload( eventName, payload, required.match ) ) return;

            this._advance();

        };

        for ( const eventName of this._watchedEvents ) {
            EventBus.on( eventName, ( payload ) => this._onRequiredActionEvent( eventName, payload ) );
        }

    }

    /**
     * We intentionally never remove individual EventBus listeners
     * here (EventBus offers no anonymous-closure removal), but the
     * listener body is a no-op once `_current` no longer expects that
     * event, so this is safe to leave bound for the life of the app.
     *
     * @returns {void}
     */
    _unbindRequiredActionListener() {
        // See docstring — listeners stay bound but become inert.
    }

    /**
     * Check whether an instruction node's requiredAction is already true
     * right now, before waiting for a fresh EventBus event — see the fix
     * note in `_goTo`. Only a handful of event types have state worth
     * checking (ones whose underlying action is idempotent/guarded, so a
     * repeat player action would never re-emit the event); everything
     * else is left to the live listener, which is safe since those
     * events fire unconditionally on every user interaction.
     *
     * Bug fix (v1.1.4): every step that logically precedes "start the
     * investigation" — open Case Management, select Case 00, start it —
     * is trivially already true the moment Case 00 IS the active
     * investigation, since none of those could have happened otherwise.
     * Kept as a general safety net even without cross-session resume
     * (v2.0.4 removed that) — it still protects against the tutorial's
     * own dialogue graph reaching a step whose action already happened
     * earlier in the same run.
     *
     * @param {Object} node
     * @returns {boolean}
     */
    _isAlreadySatisfied( node ) {

        const required = node.requiredAction;
        if ( !required ) return false;

        const match = required.match ?? {};
        const investigationAlreadyActive =
            ActiveInvestigationManager.getActive()?.caseId === TUTORIAL_CASE_ID;

        switch ( required.event ) {

            case 'app:opened':
                if ( match.appId === 'case-management' && investigationAlreadyActive ) return true;
                return !!match.appId && ApplicationManager.isRunning( match.appId );

            case 'case:card-selected':
                return investigationAlreadyActive;

            case 'investigationStarted':
                return investigationAlreadyActive;

            case 'mail:read':
                return !match.mailId || MailManager.getById( match.mailId )?.read === true;

            case 'forensics:requested':
                return !match.analysisId
                    || ForensicsManager.getById( match.analysisId )?.queueStatus !== 'Available';

            // Bug fix (v1.1.6): several instruction steps map onto a real
            // gameplay objective whose completion condition is more than
            // a single raw event (e.g. Inspect Evidence needs the item
            // both viewed AND noted; Review CCTV needs it viewed AND
            // bookmarked). Checking a single proxy event/manager flag for
            // these repeatedly went out of sync with what Case Management
            // and the Active Investigation panel actually show as
            // complete — see docs/TUTORIAL_SYSTEM.md. `objective:completed`
            // is the exact event those panels themselves are driven by, so
            // matching against it (rather than re-deriving completion from
            // a lower-level event) is the only way the tutorial and the
            // real objective state can never disagree.
            case 'objective:completed':
                return !!match.objectiveId && this._isObjectiveComplete( match.objectiveId );

            default:
                return false;

        }

    }

    /**
     * Whether a real gameplay objective is currently marked complete —
     * the same status Case Management and the Active Investigation
     * panel read. See the 'objective:completed' case above.
     *
     * @param {string} objectiveId
     * @returns {boolean}
     */
    _isObjectiveComplete( objectiveId ) {
        return ObjectiveManager.getVisibleObjectives()
            .some( o => o.id === objectiveId && o.status === 'completed' );
    }

    /**
     * Check whether an emitted payload satisfies a node's match
     * criteria. Understands the couple of nested shapes used by
     * existing gameplay events (e.g. investigationStarted's
     * `{ investigation: { caseId } }`); everything else is matched
     * as a flat top-level field.
     *
     * @param {string}      eventName
     * @param {Object}      payload
     * @param {Object|null} [match]
     * @returns {boolean}
     */
    _matchesPayload( eventName, payload, match ) {

        if ( !match ) return true;

        return Object.entries( match ).every( ( [ key, expected ] ) => {

            if ( eventName === 'investigationStarted' && key === 'caseId' ) {
                return payload?.investigation?.caseId === expected;
            }

            if ( eventName === 'objective:completed' && key === 'objectiveId' ) {
                return payload?.objective?.id === expected;
            }

            // map:search-performed carries { query, resultIds } — a step
            // that wants "the player searched and this location showed
            // up in the results" (without requiring an exact query
            // string, which would be brittle against case/whitespace)
            // uses this key instead of a flat field match.
            if ( eventName === 'map:search-performed' && key === 'containsLocationId' ) {
                return !!payload?.resultIds?.includes( expected );
            }

            // map:location-selected carries { location } — a step that
            // wants a specific location's id uses this key rather than
            // trying to flat-match a nested object.
            if ( eventName === 'map:location-selected' && key === 'locationId' ) {
                return payload?.location?.id === expected;
            }

            return payload?.[ key ] === expected;

        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Game World Locking (EPIC Part 2)
    // ─────────────────────────────────────────────────────────────

    /**
     * Lock the game world: only the tutorial dialogue/instruction UI
     * and, during an instruction, the highlighted target remain
     * interactive.
     *
     * @returns {void}
     */
    _lock() {

        if ( this._locked ) return;
        this._locked = true;

        for ( const type of INTERCEPTED_EVENTS ) {
            document.addEventListener( type, this._interceptor, true );
        }

        document.body.classList.add( 'tutorial-locked' );
        EventBus.emit( 'tutorial:locked', {} );

    }

    /**
     * Release the game world lock.
     *
     * @returns {void}
     */
    _unlock() {

        if ( !this._locked ) return;
        this._locked = false;

        for ( const type of INTERCEPTED_EVENTS ) {
            document.removeEventListener( type, this._interceptor, true );
        }

        document.body.classList.remove( 'tutorial-locked' );
        EventBus.emit( 'tutorial:unlocked', {} );

    }

    /**
     * Capture-phase handler — swallows any interaction that isn't
     * aimed at the tutorial UI itself or (while an instruction is
     * active) the currently highlighted target.
     *
     * @param {Event} event
     * @returns {void}
     */
    _handleIntercept( event ) {

        if ( !this._locked ) return;

        const withinTutorialUI = !!event.target.closest?.( '.tutorial-dialog' );
        const withinHighlightTarget = !!( TutorialHighlight.getTarget()
            && event.target.closest
            && TutorialHighlight.getTarget().contains( event.target ) );

        if ( withinTutorialUI || withinHighlightTarget ) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

    }

    // ─────────────────────────────────────────────────────────────
    // Assets
    // ─────────────────────────────────────────────────────────────

    /**
     * Inject the tutorial stylesheet once.
     *
     * @returns {void}
     */
    _injectStylesheet() {

        const href = './css/tutorial/tutorial.css';
        if ( document.querySelector( `link[href="${ href }"]` ) ) return;

        const link = document.createElement( 'link' );
        link.rel  = 'stylesheet';
        link.href = href;
        document.head.appendChild( link );

    }

}

const TutorialManager = new TutorialManagerClass();
export default TutorialManager;
