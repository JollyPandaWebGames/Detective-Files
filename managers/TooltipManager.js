/**
 * TooltipManager
 *
 * Purpose:
 *   Mission 20 — Subtle in-fiction guidance. Shows small, contextual,
 *   one-time hints anchored to a DOM element (a desktop icon, a taskbar
 *   button, or any element carrying a `data-tooltip-anchor` attribute)
 *   when a case-authored trigger condition fires. Contains no
 *   investigation-specific copy or logic — every case supplies its own
 *   tooltips.json, exactly like Missions 16-19's engines.
 *
 * Responsibilities:
 *   - Load a case's tooltips.json on investigationChanged
 *   - Listen for the trigger events tooltips can key off of:
 *     objective:unlocked, objective:revealed, app:opened
 *   - Track which tooltip ids have already been shown (per case,
 *     persisted) so each tip appears at most once
 *   - Respect Settings > "Show contextual tooltips"
 *   - Render a small floating bubble near the matched target element,
 *     with a brief highlight pulse on the element itself, and dismiss
 *     it automatically or on click
 *
 * Storage key: 'tooltips-shown:{caseId}'   — array of shown tooltip ids
 *
 * Trigger types (tooltips.json):
 *   objectiveUnlocked   { target: objectiveId }
 *   objectiveRevealed   { target: objectiveId }
 *   appOpened           { target: appId }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Never contain case-specific copy — every case supplies its own
 *   tooltips.json.
 */

import StorageManager  from './StorageManager.js';
import SettingsManager from './SettingsManager.js';
import EventBus         from '../core/EventBus.js';

const CASE_BASE     = './data/cases/';
const DISMISS_AFTER = 7000;

const TRIGGER_EVENT_MAP = {
    objectiveUnlocked: { event: 'objective:unlocked', extractTarget: p => p.objectiveId },
    objectiveRevealed: { event: 'objective:revealed', extractTarget: p => p.objectiveId },
    appOpened:         { event: 'app:opened',         extractTarget: p => p.appId },
};

class TooltipManagerClass {

    constructor() {

        /** @type {string|null} */
        this._caseId = null;

        /** @type {Object[]} */
        this._tooltips = [];

        /** @type {Set<string>} */
        this._shown = new Set();

        /** @type {HTMLElement|null} */
        this._bubbleEl = null;

        /** @type {HTMLElement|null} */
        this._highlightedTarget = null;

        /** @type {number|null} */
        this._dismissTimer = null;

    }

    /**
     * Wire the case-load bridge and global trigger listeners. Called
     * once by Workstation during boot.
     *
     * @returns {void}
     */
    initialize() {

        EventBus.on( 'investigationChanged', ( { investigation } ) => {
            if ( investigation?.caseId ) this.loadForCase( investigation.caseId );
            else this.unloadCase();
        } );

        for ( const [ triggerType, def ] of Object.entries( TRIGGER_EVENT_MAP ) ) {
            EventBus.on( def.event, payload => this._onTriggerEvent( triggerType, def.extractTarget( payload ) ) );
        }

        console.info( 'TooltipManager: Initialized.' );

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
            const res = await fetch( `${ CASE_BASE }${ caseId }/tooltips.json` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();
            this._tooltips = data.tooltips ?? [];
        }
        catch ( error ) {
            // Not every case needs tooltips — silent by design, same as
            // ResolutionManager's missing-solution.json handling.
            this._tooltips = [];
        }

        const saved = StorageManager.load( this._storageKey(), [] );
        this._shown = new Set( saved );

    }

    /** @returns {void} */
    unloadCase() {
        this._dismiss();
        this._caseId   = null;
        this._tooltips = [];
        this._shown    = new Set();
    }

    // ─────────────────────────────────────────────────────────────
    // Trigger handling
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {string}      triggerType
     * @param {string|null} target
     * @returns {void}
     */
    _onTriggerEvent( triggerType, target ) {

        if ( !this._caseId || target == null ) return;
        if ( this._isDisabled() ) return;

        const tip = this._tooltips.find( t =>
            t.trigger?.type === triggerType &&
            t.trigger?.target === target &&
            !this._shown.has( t.id )
        );

        if ( !tip ) return;

        // Give the newly-opened window / newly-unlocked UI a beat to
        // actually paint before we measure its position.
        setTimeout( () => this._show( tip ), 350 );

    }

    /** @returns {boolean} */
    _isDisabled() {
        return SettingsManager.get( 'tooltipsEnabled' ) === false;
    }

    // ─────────────────────────────────────────────────────────────
    // Rendering
    // ─────────────────────────────────────────────────────────────

    /**
     * @param {Object} tip
     * @returns {void}
     */
    _show( tip ) {

        const target = document.querySelector( tip.targetSelector );
        if ( !target ) return;

        this._dismiss();
        this._markShown( tip.id );

        const rect = target.getBoundingClientRect();

        const bubble = document.createElement( 'div' );
        bubble.className   = 'cid-tooltip-bubble';
        bubble.textContent = tip.text;

        document.body.appendChild( bubble );

        const bubbleRect = bubble.getBoundingClientRect();
        const top  = Math.max( 8, rect.top - bubbleRect.height - 10 );
        const left = Math.min(
            window.innerWidth - bubbleRect.width - 8,
            Math.max( 8, rect.left + ( rect.width / 2 ) - ( bubbleRect.width / 2 ) )
        );

        bubble.style.top  = `${ top }px`;
        bubble.style.left = `${ left }px`;
        bubble.classList.add( 'cid-tooltip-bubble--visible' );

        target.classList.add( 'cid-tooltip-target-highlight' );

        this._bubbleEl = bubble;
        this._highlightedTarget = target;

        const dismiss = () => this._dismiss();
        bubble.addEventListener( 'click', dismiss );
        this._dismissTimer = setTimeout( dismiss, DISMISS_AFTER );

    }

    /** @returns {void} */
    _dismiss() {

        if ( this._dismissTimer ) {
            clearTimeout( this._dismissTimer );
            this._dismissTimer = null;
        }

        if ( this._bubbleEl ) {
            this._bubbleEl.remove();
            this._bubbleEl = null;
        }

        if ( this._highlightedTarget ) {
            this._highlightedTarget.classList.remove( 'cid-tooltip-target-highlight' );
            this._highlightedTarget = null;
        }

    }

    /**
     * @param {string} id
     * @returns {void}
     */
    _markShown( id ) {
        this._shown.add( id );
        StorageManager.save( this._storageKey(), [ ...this._shown ] );
    }

    /**
     * Case 00 replay support — wipe this case's shown-tooltip history so
     * every tip re-fires on the next loadForCase(). Call before
     * loadForCase().
     *
     * @param {string} caseId
     * @returns {void}
     */
    resetForCase( caseId ) {
        StorageManager.remove( `tooltips-shown:${ caseId }` );
    }

    /** @returns {string} */
    _storageKey() {
        return `tooltips-shown:${ this._caseId }`;
    }

}

const TooltipManager = new TooltipManagerClass();
export default TooltipManager;
