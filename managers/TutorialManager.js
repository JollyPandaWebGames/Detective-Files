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
 *   - Reset and replay from the beginning every time Case 00 is
 *     started (Case 00 is always a tutorial — see EPIC Part 8)
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
 *   applications already emit on EventBus.
 *
 * Events emitted:
 *   tutorial:started    { caseId }
 *   tutorial:locked      {}
 *   tutorial:unlocked    {}
 *   tutorial:completed  { caseId }
 *   tutorial:skipped    { caseId }
 *
 * Dependencies:
 *   EventBus, TutorialDialog, TutorialHighlight, CaseManager
 */

import EventBus                    from '../core/EventBus.js';
import TutorialDialog              from '../ui/TutorialDialog.js';
import TutorialHighlight           from '../ui/TutorialHighlight.js';
import CaseManager                 from './CaseManager.js';
import ApplicationManager          from './ApplicationManager.js';
import ActiveInvestigationManager  from './ActiveInvestigationManager.js';
import MailManager                 from './MailManager.js';
import ForensicsManager            from './ForensicsManager.js';

const DIALOGUE_URL = './data/tutorial/case-00-dialogue.json';
const TUTORIAL_CASE_ID = 'case-00';

// DOM/keyboard event types intercepted while the tutorial is locked.
const INTERCEPTED_EVENTS = [ 'click', 'pointerdown', 'mousedown', 'keydown', 'touchstart' ];

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

        // Case 00 is always a tutorial (EPIC Part 8) — every time an
        // investigation starts on it, reset and replay from the top,
        // UNLESS we are already mid-tutorial and this is exactly the
        // action a live instruction step is waiting on (handled by
        // the generic requiredAction listener below, which runs first
        // since it is registered before this one).
        EventBus.on( 'investigationStarted', ( { investigation } ) => {

            if ( !investigation || investigation.caseId !== TUTORIAL_CASE_ID ) return;
            if ( this._active ) return; // already mid-sequence — the instruction handler advances it

            this.start();

        } );

        // First-run auto-start: if the player has never touched Case 00
        // and nothing else is currently active, open with the mentor
        // introduction unprompted.
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
     * (Re)start the tutorial from its first node. Safe to call while
     * already active — resets tutorial progression, per EPIC Part 8.
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
        this._lock();

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

        const speaker = this._data.speakers[ node.speaker ] ?? { name: node.speaker, emoji: '🕵️' };

        if ( node.type === 'dialogue' ) {

            TutorialHighlight.hide();
            TutorialDialog.showDialogue(
                { speakerName: speaker.name, portraitEmoji: speaker.emoji, text: node.text },
                {
                    onContinue: () => this._goTo( node.next ),
                    onSkip:     () => this._skip(),
                }
            );

        } else if ( node.type === 'instruction' ) {

            // The dialogue box closes temporarily; the relevant UI is
            // highlighted and a short instruction banner is shown —
            // EPIC Part 3/6. The player must perform the real action;
            // there is no Continue button here by design.
            if ( node.highlightTarget ) {
                TutorialHighlight.show( node.highlightTarget, node.highlightScope ?? null );
            } else {
                TutorialHighlight.hide();
            }

            TutorialDialog.showInstruction( node.text );

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
     * End the tutorial sequence normally (reached the last node).
     *
     * @returns {void}
     */
    _finish() {

        this._active  = false;
        this._current = null;
        this._unlock();
        TutorialDialog.hide();
        TutorialHighlight.hide();
        this._unbindRequiredActionListener();

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
        this._unlock();
        TutorialDialog.hide();
        TutorialHighlight.hide();
        this._unbindRequiredActionListener();

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
     * @param {Object} node
     * @returns {boolean}
     */
    _isAlreadySatisfied( node ) {

        const required = node.requiredAction;
        if ( !required ) return false;

        const match = required.match ?? {};

        switch ( required.event ) {

            case 'app:opened':
                return !!match.appId && ApplicationManager.isRunning( match.appId );

            case 'investigationStarted':
                return ActiveInvestigationManager.getActive()?.caseId === match.caseId;

            case 'mail:read':
                return !match.mailId || MailManager.getById( match.mailId )?.read === true;

            case 'forensics:requested':
                return !match.analysisId
                    || ForensicsManager.getById( match.analysisId )?.queueStatus !== 'Available';

            default:
                return false;

        }

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
