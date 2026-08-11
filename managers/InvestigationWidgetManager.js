/**
 * InvestigationWidgetManager
 *
 * Purpose:
 *   Builds and owns the permanent Active Investigation widget required by
 *   Epic 01 — CID OS Architecture 2.0. Fixed to the bottom-right of the
 *   desktop, on every device size. Cannot be closed — only expanded or
 *   collapsed.
 *
 * Responsibilities:
 *   - Render the widget's three states: No Active Investigation,
 *     Active, and Completed
 *   - Reflect case name, progress, objectives, and status live
 *   - Provide an "Open Case" button that launches Case Management
 *   - Persist the collapsed/expanded state via SessionManager
 *
 * Rules:
 *   Never mutate investigation state directly — read-only display plus
 *   an "Open Case" affordance. All state changes flow back through
 *   ApplicationContext.investigation.
 *
 * Dependencies:
 *   ApplicationContext — source of currentInvestigation
 *   SessionManager     — persists collapsed/expanded state
 *   EventBus           — requests application launches
 */

import ApplicationContext from '../core/ApplicationContext.js';
import SessionManager     from './SessionManager.js';
import EventBus           from '../core/EventBus.js';

class InvestigationWidgetManagerClass {

    constructor() {
        /** @type {HTMLElement|null} */
        this._el = null;

        /** @type {boolean} */
        this._initialized = false;

        this._onContextChanged = () => this._render();
    }

    /**
     * Mount the widget into the desktop and start listening for context
     * changes. Safe to call once, after the desktop DOM exists.
     *
     * @param {HTMLElement} desktopEl
     * @returns {void}
     */
    initialize( desktopEl ) {

        if ( this._initialized || !desktopEl ) return;
        this._initialized = true;

        this._el = document.createElement( 'div' );
        this._el.className = 'investigation-widget';
        this._el.setAttribute( 'role', 'complementary' );
        this._el.setAttribute( 'aria-label', 'Active Investigation' );

        desktopEl.appendChild( this._el );

        EventBus.on( 'context:changed',         this._onContextChanged );
        EventBus.on( 'investigationChanged',    this._onContextChanged );
        EventBus.on( 'case:progress',            this._onContextChanged );
        EventBus.on( 'objective:loaded',         this._onContextChanged );
        EventBus.on( 'objective:completed',      this._onContextChanged );
        EventBus.on( 'objective:progress',       this._onContextChanged );
        EventBus.on( 'objective:phase-changed',  this._onContextChanged );

        this._render();

    }

    // ─────────────────────────────────────────────────────────────
    // Rendering
    // ─────────────────────────────────────────────────────────────

    /**
     * Render the widget for the current investigation state.
     * @returns {void}
     */
    _render() {

        if ( !this._el ) return;

        const investigation = ApplicationContext.currentInvestigation;
        const collapsed     = SessionManager.isWidgetCollapsed();

        this._el.classList.toggle( 'investigation-widget--collapsed', collapsed );

        if ( !investigation ) {
            this._el.innerHTML = this._renderEmpty( collapsed );
        }
        else if ( investigation.status === 'Completed' ) {
            this._el.innerHTML = this._renderCompleted( investigation, collapsed );
        }
        else {
            this._el.innerHTML = this._renderActive( investigation, collapsed );
        }

        this._wireEvents( investigation );

    }

    /**
     * @param {boolean} collapsed
     * @returns {string}
     */
    _renderEmpty( collapsed ) {

        if ( collapsed ) {
            return `
                <button type="button" class="investigation-widget__toggle" data-action="expand" aria-label="Expand">🗂️</button>
            `;
        }

        return `
            <div class="investigation-widget__header">
                <span class="investigation-widget__title">No Active Investigation</span>
                <button type="button" class="investigation-widget__toggle" data-action="collapse" aria-label="Collapse">–</button>
            </div>
            <div class="investigation-widget__body investigation-widget__body--empty">
                No active investigation.<br>Open Case Management to begin.
            </div>
            <button type="button" class="investigation-widget__action" data-action="open-case-management">
                Open Case Management
            </button>
        `;

    }

    /**
     * @param {Object}  inv
     * @param {boolean} collapsed
     * @returns {string}
     */
    _renderActive( inv, collapsed ) {

        if ( collapsed ) {
            return `
                <button type="button" class="investigation-widget__toggle investigation-widget__toggle--badge" data-action="expand" aria-label="Expand">
                    🗂️ <span class="investigation-widget__badge">${ Math.round( inv.progress ) }%</span>
                </button>
            `;
        }

        const details          = ApplicationContext.getAvailableObjectiveDetails();
        const current          = details[ 0 ] ?? null;
        const currentTitle     = current?.title ?? ( inv.currentObjectives ?? [] )[ 0 ] ?? 'No objectives remaining';
        const currentDesc      = current?.description ?? '';
        const isCritical       = current?.priority === 'critical';

        return `
            <div class="investigation-widget__header">
                <span class="investigation-widget__title">${ this._escape( inv.title ) }</span>
                <button type="button" class="investigation-widget__toggle" data-action="collapse" aria-label="Collapse">–</button>
            </div>
            <div class="investigation-widget__status investigation-widget__status--active">${ inv.status }</div>
            <div class="investigation-widget__objective${ isCritical ? ' investigation-widget__objective--critical' : '' }">${ this._escape( currentTitle ) }</div>
            ${ currentDesc ? `<div class="investigation-widget__objective-desc">${ this._escape( currentDesc ) }</div>` : '' }
            <div class="investigation-widget__progress-track">
                <div class="investigation-widget__progress-fill" style="width:${ Math.max( 0, Math.min( 100, inv.progress ) ) }%"></div>
            </div>
            <div class="investigation-widget__progress-label">${ Math.round( inv.progress ) }% complete</div>
            <button type="button" class="investigation-widget__action" data-action="open-case-management">
                Open Case
            </button>
        `;

    }

    /**
     * @param {Object}  inv
     * @param {boolean} collapsed
     * @returns {string}
     */
    _renderCompleted( inv, collapsed ) {

        if ( collapsed ) {
            return `
                <button type="button" class="investigation-widget__toggle investigation-widget__toggle--badge" data-action="expand" aria-label="Expand">✅</button>
            `;
        }

        return `
            <div class="investigation-widget__header">
                <span class="investigation-widget__title">${ this._escape( inv.title ) }</span>
                <button type="button" class="investigation-widget__toggle" data-action="collapse" aria-label="Collapse">–</button>
            </div>
            <div class="investigation-widget__status investigation-widget__status--completed">✅ Completed</div>
            <button type="button" class="investigation-widget__action" data-action="open-case-management">
                Start a New Investigation
            </button>
        `;

    }

    /**
     * Wire click handlers for the freshly-rendered widget markup.
     * @param {Object|null} investigation
     * @returns {void}
     */
    _wireEvents( investigation ) {

        const collapseBtn = this._el.querySelector( '[data-action="collapse"]' );
        const expandBtn    = this._el.querySelector( '[data-action="expand"]' );
        const openBtn       = this._el.querySelector( '[data-action="open-case-management"]' );

        if ( collapseBtn ) collapseBtn.addEventListener( 'click', () => this._setCollapsed( true ) );
        if ( expandBtn )    expandBtn.addEventListener( 'click',    () => this._setCollapsed( false ) );

        if ( openBtn ) {
            openBtn.addEventListener( 'click', () => {
                EventBus.emit( 'application:requested', { appId: 'case-management' } );
            } );
        }

    }

    /**
     * @param {boolean} collapsed
     * @returns {void}
     */
    _setCollapsed( collapsed ) {
        SessionManager.setWidgetCollapsed( collapsed );
        this._render();
    }

    /**
     * @param {string} str
     * @returns {string}
     */
    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

// Singleton.
const InvestigationWidgetManager = new InvestigationWidgetManagerClass();

export default InvestigationWidgetManager;
