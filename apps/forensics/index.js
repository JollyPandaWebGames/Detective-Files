/**
 * Forensics Lab
 *
 * Purpose:
 *   Laboratory analysis queue. Detectives submit evidence, wait for
 *   timed analyses to complete, then collect detailed reports.
 *
 * Layout:
 *   Desktop  — three panels: queue sidebar | selected analysis | evidence info
 *   Tablet   — collapsible sidebar
 *   Phone    — stacked: queue → analysis → evidence
 *
 * Timer architecture:
 *   Timers are timestamp-based (Date.now() + duration * 1000).
 *   ForensicsManager polls every 5s while the window is open.
 *   Progress survives app close/reopen.
 *
 * Events consumed:
 *   investigationChanged   — load analyses for the new investigation (Epic 01.1)
 *   forensics:completed    — refresh queue, show notification
 *   forensics:collected    — refresh queue
 *   evidence:selected      — pre-select analysis for that evidence
 *
 * Events emitted:
 *   forensics:requested    — via ForensicsManager
 *   forensics:completed    — via ForensicsManager
 *   forensics:collected    — via ForensicsManager
 *   forensics:note-updated — via ForensicsManager
 */

import BaseApp          from '../../core/BaseApp.js';
import EventBus         from '../../core/EventBus.js';
import ForensicsManager from '../../managers/ForensicsManager.js';
import EvidenceManager  from '../../managers/EvidenceManager.js';

const NOTES_DELAY = 800;

const STATUS_META = {
    'Available':   { emoji: '🔬', class: 'flab-status--available'   },
    'In Progress': { emoji: '⏳', class: 'flab-status--progress'    },
    'Completed':   { emoji: '✅', class: 'flab-status--completed'   },
    'Collected':   { emoji: '📋', class: 'flab-status--collected'   },
};

const TYPE_EMOJI = {
    'Fingerprint':        '👆',
    'DNA':                '🧬',
    'Blood':              '🩸',
    'Toxicology':         '⚗️',
    'Ballistics':         '🔫',
    'Fiber':              '🧵',
    'Document':           '📄',
    'Digital Device':     '💾',
};

const QUEUE_TABS = [
    { id: 'all',         label: 'All'         },
    { id: 'In Progress', label: 'In Progress' },
    { id: 'Completed',   label: 'Completed'   },
    { id: 'Available',   label: 'Available'   },
    { id: 'Collected',   label: 'Collected'   },
];

class Forensics extends BaseApp {

    constructor( config ) {
        super( config );

        /** @type {string} */
        this._activeTab      = 'all';
        /** @type {string|null} */
        this._selectedId     = null;
        /** @type {string|null} */
        this._activeCaseId   = null;
        /** @type {string} */
        this._searchQuery    = '';

        // DOM refs.
        this._queueEl        = null;
        this._centerEl       = null;
        this._evidenceInfoEl = null;
        this._searchInput    = null;
        this._tabsEl         = null;

        // Countdown display timer.
        this._countdownTimer = null;
        this._notesTimer     = null;

        // Bound EventBus handlers.
        this._onInvestigationChanged = ( { investigation } ) => this._syncInvestigation( investigation );
        this._onCompleted       = ()               => this._refreshQueue();
        this._onCollected       = ()               => this._refreshQueue();

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {
        contentEl.classList.add( 'flab' );
        this._buildLayout( contentEl );
    }

    open() {
        EventBus.on( 'investigationChanged', this._onInvestigationChanged );
        EventBus.on( 'forensics:completed', this._onCompleted    );
        EventBus.on( 'forensics:collected', this._onCollected    );

        ForensicsManager.startPolling();
        this._startCountdown();
        this._syncInvestigation( this.context.getActiveInvestigation() );
    }

    close() {
        EventBus.off( 'investigationChanged', this._onInvestigationChanged );
        EventBus.off( 'forensics:completed', this._onCompleted    );
        EventBus.off( 'forensics:collected', this._onCollected    );

        ForensicsManager.stopPolling();
        this._stopCountdown();
        clearTimeout( this._notesTimer );
    }

    minimize() { ForensicsManager.stopPolling(); this._stopCountdown(); }
    restore()  { ForensicsManager.startPolling(); this._startCountdown(); this._refreshQueue(); }

    destroy() {
        ForensicsManager.stopPolling();
        this._stopCountdown();
        clearTimeout( this._notesTimer );
        this._queueEl        = null;
        this._centerEl       = null;
        this._evidenceInfoEl = null;
        this._searchInput    = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    _buildLayout( contentEl ) {

        // ── Left — queue ──────────────────────────────────────────
        const left = document.createElement( 'div' );
        left.className = 'flab__left';

        // Tabs.
        this._tabsEl = document.createElement( 'div' );
        this._tabsEl.className = 'flab__tabs';
        QUEUE_TABS.forEach( tab => {
            const btn = document.createElement( 'button' );
            btn.className    = 'flab__tab-btn';
            btn.dataset.tab  = tab.id;
            btn.textContent  = tab.label;
            btn.setAttribute( 'type', 'button' );
            btn.addEventListener( 'click', () => this._selectTab( tab.id ) );
            this._tabsEl.appendChild( btn );
        } );

        // Search.
        const searchWrap = document.createElement( 'div' );
        searchWrap.className = 'flab__search-wrap';
        this._searchInput = document.createElement( 'input' );
        this._searchInput.type        = 'text';
        this._searchInput.className   = 'flab__search-input';
        this._searchInput.placeholder = 'Search analyses...';
        this._searchInput.addEventListener( 'input', () => {
            this._searchQuery = this._searchInput.value;
            this._refreshQueue();
        } );
        searchWrap.appendChild( this._searchInput );

        this._queueEl = document.createElement( 'div' );
        this._queueEl.className = 'flab__queue';

        left.appendChild( this._tabsEl );
        left.appendChild( searchWrap );
        left.appendChild( this._queueEl );

        // ── Center — selected analysis ────────────────────────────
        this._centerEl = document.createElement( 'div' );
        this._centerEl.className = 'flab__center';
        this._renderEmptyCenter();

        // ── Right — evidence info ─────────────────────────────────
        this._evidenceInfoEl = document.createElement( 'div' );
        this._evidenceInfoEl.className = 'flab__evidence-info';
        this._renderEmptyEvidence();

        contentEl.appendChild( left );
        contentEl.appendChild( this._centerEl );
        contentEl.appendChild( this._evidenceInfoEl );

    }

    // ─────────────────────────────────────────────────────────────
    // Queue
    // ─────────────────────────────────────────────────────────────

    _syncInvestigation( investigation ) {

        if ( !investigation ) {
            this._activeCaseId = null;
            this._renderEmptyCenter();
            this._renderEmptyEvidence();
            this._refreshQueue();
            return;
        }

        if ( this._activeCaseId === investigation.caseId ) {
            this._refreshQueue();
            return;
        }

        this._activeCaseId = investigation.caseId;
        this._selectedId = null;
        this._renderEmptyCenter();
        this._renderEmptyEvidence();
        ForensicsManager.loadForCase( investigation.caseId ).then( () => this._refreshQueue() );
    }

    _selectTab( tabId ) {
        this._activeTab = tabId;
        this._tabsEl.querySelectorAll( '.flab__tab-btn' ).forEach( btn => {
            btn.classList.toggle( 'flab__tab-btn--active', btn.dataset.tab === tabId );
        } );
        this._refreshQueue();
    }

    _refreshQueue() {

        if ( !this._queueEl ) return;

        if ( !this._activeCaseId ) {
            this._queueEl.innerHTML = `<div class="flab__empty-hint">No active investigation.<br>Open Case Management and start an investigation.</div>`;
            return;
        }

        let analyses = this._searchQuery.trim()
            ? ForensicsManager.search( this._searchQuery )
            : ( this._activeTab === 'all' ? ForensicsManager.getAll() : ForensicsManager.getByStatus( this._activeTab ) );

        // Sort: In Progress first, then Completed, Available, Collected.
        const order = { 'In Progress': 0, 'Completed': 1, 'Available': 2, 'Collected': 3 };
        analyses = [ ...analyses ].sort( ( a, b ) =>
            ( order[ a.queueStatus ] ?? 9 ) - ( order[ b.queueStatus ] ?? 9 )
        );

        this._queueEl.innerHTML = '';

        if ( analyses.length === 0 ) {
            this._queueEl.innerHTML = `<div class="flab__empty-hint">${
                this._searchQuery ? 'No results match your search.' : 'No analyses in this category.'
            }</div>`;
            return;
        }

        analyses.forEach( a => this._queueEl.appendChild( this._buildQueueItem( a ) ) );

        // Restore selection highlight.
        if ( this._selectedId ) {
            const el = this._queueEl.querySelector( `[data-analysis-id="${ this._selectedId }"]` );
            if ( el ) el.classList.add( 'flab__queue-item--selected' );
        }

        this._updateTabCounts();

    }

    _updateTabCounts() {

        if ( !this._tabsEl ) return;
        const all = ForensicsManager.getAll();
        this._tabsEl.querySelectorAll( '.flab__tab-btn' ).forEach( btn => {
            const tab   = btn.dataset.tab;
            const count = tab === 'all' ? all.length : all.filter( a => a.queueStatus === tab ).length;
            btn.setAttribute( 'data-count', count > 0 ? String( count ) : '' );
        } );

    }

    _buildQueueItem( a ) {

        const item = document.createElement( 'div' );
        item.className = 'flab__queue-item';
        item.dataset.analysisId = a.id;
        item.setAttribute( 'tabindex', '0' );

        if ( a.id === this._selectedId ) item.classList.add( 'flab__queue-item--selected' );

        const meta    = STATUS_META[ a.queueStatus ] ?? STATUS_META['Available'];
        const typeEmoji = TYPE_EMOJI[ a.type ] ?? '🔬';
        const remaining = a.queueStatus === 'In Progress' ? ForensicsManager.getRemainingSeconds( a.id ) : null;

        item.innerHTML = `
            <div class="flab__qi-icon">${ typeEmoji }</div>
            <div class="flab__qi-body">
                <div class="flab__qi-type">${ this._escape( a.type ) } Analysis</div>
                <div class="flab__qi-evidence">${ this._escape( a.evidenceTitle ?? a.evidenceId ) }</div>
                ${ remaining !== null
                    ? `<div class="flab__qi-timer" data-analysis-timer="${ a.id }">⏱ ${ this._formatTime( remaining ) }</div>`
                    : '' }
            </div>
            <div class="flab__qi-status ${ meta.class }">${ meta.emoji }</div>
        `;

        item.addEventListener( 'click', () => this._selectAnalysis( a.id ) );
        item.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); this._selectAnalysis( a.id ); }
        } );

        return item;

    }

    // ─────────────────────────────────────────────────────────────
    // Center — Analysis Detail
    // ─────────────────────────────────────────────────────────────

    _selectAnalysis( id ) {

        const a = ForensicsManager.getById( id );
        if ( !a ) return;

        this._selectedId = id;

        this._queueEl.querySelectorAll( '.flab__queue-item' ).forEach( el => {
            el.classList.toggle( 'flab__queue-item--selected', el.dataset.analysisId === id );
        } );

        this._renderCenter( a );
        this._renderEvidenceInfo( a.evidenceId );

    }

    _renderCenter( a ) {

        if ( !this._centerEl ) return;

        const meta      = STATUS_META[ a.queueStatus ] ?? STATUS_META['Available'];
        const typeEmoji = TYPE_EMOJI[ a.type ] ?? '🔬';
        const remaining = a.queueStatus === 'In Progress'
            ? ForensicsManager.getRemainingSeconds( a.id )
            : null;

        this._centerEl.innerHTML = `
            <div class="flab__center-header">
                <div class="flab__center-icon">${ typeEmoji }</div>
                <div class="flab__center-title">${ this._escape( a.type ) } Analysis</div>
                <div class="flab__center-status ${ meta.class }">${ meta.emoji } ${ a.queueStatus }</div>
            </div>

            <div class="flab__center-body">
                <div class="flab__detail-section">Evidence</div>
                <div class="flab__detail-value">${ this._escape( a.evidenceTitle ?? a.evidenceId ) }</div>

                <div class="flab__detail-section">Description</div>
                <div class="flab__detail-description"></div>

                <div class="flab__detail-section">Duration</div>
                <div class="flab__detail-value">${ this._formatTime( a.duration ) }</div>

                ${ remaining !== null ? `
                    <div class="flab__detail-section">Time Remaining</div>
                    <div class="flab__center-countdown" data-countdown="${ a.id }">
                        ${ this._formatTime( remaining ) }
                    </div>
                    <div class="flab__progress-wrap">
                        <div class="flab__progress-fill" style="width:${ this._progressPct( a ) }%"></div>
                    </div>
                ` : '' }

                <div class="flab__center-actions"></div>

                ${ a.queueStatus === 'Completed' || a.queueStatus === 'Collected'
                    ? '<div class="flab__result-section"></div>'
                    : '' }

                <div class="flab__detail-section">Investigation Notes</div>
                <textarea class="flab__notes" placeholder="Notes about this analysis..."></textarea>
            </div>
        `;

        this._centerEl.querySelector( '.flab__detail-description' ).textContent = a.description ?? '';

        // Action buttons.
        const actionsEl = this._centerEl.querySelector( '.flab__center-actions' );
        if ( a.queueStatus === 'Available' ) {
            const submitBtn = document.createElement( 'button' );
            submitBtn.className   = 'flab__action-btn flab__action-btn--submit';
            submitBtn.textContent = '🔬 Submit for Analysis';
            submitBtn.setAttribute( 'type', 'button' );
            submitBtn.addEventListener( 'click', () => {
                ForensicsManager.requestAnalysis( a.id );
                this._selectAnalysis( a.id );
                this._refreshQueue();
            } );
            actionsEl.appendChild( submitBtn );
        }
        else if ( a.queueStatus === 'Completed' ) {
            const collectBtn = document.createElement( 'button' );
            collectBtn.className   = 'flab__action-btn flab__action-btn--collect';
            collectBtn.textContent = '📋 Collect Report';
            collectBtn.setAttribute( 'type', 'button' );
            collectBtn.addEventListener( 'click', async () => {
                await ForensicsManager.collectResult( a.id );
                this._selectAnalysis( a.id );
                this._refreshQueue();
            } );
            actionsEl.appendChild( collectBtn );
        }

        // Result section.
        const resultSection = this._centerEl.querySelector( '.flab__result-section' );
        if ( resultSection ) {
            this._renderResult( a.id, resultSection );
        }

        // Notes.
        const notesEl = this._centerEl.querySelector( '.flab__notes' );
        notesEl.value = ForensicsManager.getNotes( a.id );
        notesEl.addEventListener( 'input', () => {
            clearTimeout( this._notesTimer );
            this._notesTimer = setTimeout( () => {
                ForensicsManager.saveNotes( a.id, notesEl.value );
            }, NOTES_DELAY );
        } );

    }

    _renderResult( analysisId, containerEl ) {

        const result = ForensicsManager.getResult( analysisId );
        if ( !result ) {
            containerEl.innerHTML = '<div class="flab__detail-section">Result</div><div class="flab__empty-hint">Loading result...</div>';
            // Try to load it.
            ForensicsManager._loadResult( ForensicsManager._analyses?.get?.( analysisId ) ?? {} )
                .then( () => {
                    const r = ForensicsManager.getResult( analysisId );
                    if ( r ) this._renderResult( analysisId, containerEl );
                } );
            return;
        }

        containerEl.innerHTML = `
            <div class="flab__detail-section">Result Summary</div>
            <div class="flab__result-summary"></div>

            <div class="flab__detail-section">Confidence</div>
            <div class="flab__confidence-wrap">
                <div class="flab__confidence-bar">
                    <div class="flab__confidence-fill" style="width:${ result.confidence }%"></div>
                </div>
                <span class="flab__confidence-val">${ result.confidence }%</span>
            </div>

            <div class="flab__detail-section">Full Details</div>
            <div class="flab__result-details"></div>

            <div class="flab__detail-section">Recommendations</div>
            <div class="flab__result-recommendations"></div>
        `;

        containerEl.querySelector( '.flab__result-summary' ).textContent = result.summary;
        containerEl.querySelector( '.flab__result-details' ).textContent = result.details;

        const recEl = containerEl.querySelector( '.flab__result-recommendations' );
        ( result.recommendations ?? [] ).forEach( r => {
            const row = document.createElement( 'div' );
            row.className   = 'flab__recommendation';
            row.textContent = r;
            recEl.appendChild( row );
        } );

        if ( !result.recommendations?.length ) {
            recEl.innerHTML = '<span class="flab__empty-hint">No recommendations.</span>';
        }

    }

    _renderEmptyCenter() {

        if ( !this._centerEl ) return;
        this._centerEl.innerHTML = `
            <div class="flab__center-empty">
                <div class="flab__center-empty-emoji">🧪</div>
                <div class="flab__center-empty-text">Select an analysis from the queue</div>
            </div>
        `;

    }

    // ─────────────────────────────────────────────────────────────
    // Right — Evidence Info
    // ─────────────────────────────────────────────────────────────

    _renderEvidenceInfo( evidenceId ) {

        if ( !this._evidenceInfoEl ) return;

        const ev = EvidenceManager.getById( evidenceId );

        if ( !ev ) {
            this._evidenceInfoEl.innerHTML = `
                <div class="flab__ev-header">🔍 Evidence</div>
                <div class="flab__empty-hint">Evidence not loaded.<br>Select case first.</div>
            `;
            return;
        }

        this._evidenceInfoEl.innerHTML = `
            <div class="flab__ev-header">🔍 Evidence</div>
            <div class="flab__ev-id">${ this._escape( ev.id ) }</div>
            <div class="flab__ev-title">${ this._escape( ev.title ) }</div>
            <div class="flab__ev-category">${ this._escape( ev.category ) }</div>
            <div class="flab__ev-status">${ this._escape( ev.status ) }</div>
            <div class="flab__detail-section">Description</div>
            <div class="flab__ev-description"></div>
            <div class="flab__detail-section">Location Found</div>
            <div class="flab__ev-location">${ this._escape( ev.location ?? '—' ) }</div>
            <button type="button" class="flab__ev-open-btn">🔍 Open in Evidence Database</button>
        `;

        this._evidenceInfoEl.querySelector( '.flab__ev-description' ).textContent = ev.description ?? '';

        this._evidenceInfoEl.querySelector( '.flab__ev-open-btn' )
            .addEventListener( 'click', () => {
                EventBus.emit( 'application:requested', { appId: 'evidence' } );
                setTimeout( () => EventBus.emit( 'evidence:focus-request', { evidenceId: ev.id } ), 300 );
            } );

    }

    _renderEmptyEvidence() {

        if ( !this._evidenceInfoEl ) return;
        this._evidenceInfoEl.innerHTML = `
            <div class="flab__ev-header">🔍 Evidence</div>
            <div class="flab__empty-hint">Select an analysis to view the associated evidence.</div>
        `;

    }

    // ─────────────────────────────────────────────────────────────
    // Countdown
    // ─────────────────────────────────────────────────────────────

    _startCountdown() {

        this._stopCountdown();
        this._countdownTimer = setInterval( () => this._updateCountdowns(), 1000 );

    }

    _stopCountdown() {

        if ( this._countdownTimer !== null ) {
            clearInterval( this._countdownTimer );
            this._countdownTimer = null;
        }

    }

    _updateCountdowns() {

        // Update countdown in queue items.
        document.querySelectorAll( '[data-analysis-timer]' ).forEach( el => {
            const id  = el.dataset.analysisTimer;
            const sec = ForensicsManager.getRemainingSeconds( id );
            el.textContent = `⏱ ${ this._formatTime( sec ) }`;
        } );

        // Update countdown in center panel.
        const centerCountdown = document.querySelector( '[data-countdown]' );
        if ( centerCountdown ) {
            const id  = centerCountdown.dataset.countdown;
            const sec = ForensicsManager.getRemainingSeconds( id );
            centerCountdown.textContent = this._formatTime( sec );

            // Update progress bar.
            const fill = this._centerEl?.querySelector( '.flab__progress-fill' );
            const a    = ForensicsManager.getById( id );
            if ( fill && a ) {
                fill.style.width = `${ this._progressPct( a ) }%`;
            }
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    _progressPct( a ) {

        const saved = ForensicsManager._state?.[ a.id ];
        if ( !saved?.requestedAt ) return 0;
        const elapsed   = ( Date.now() - saved.requestedAt ) / 1000;
        return Math.min( 100, Math.round( ( elapsed / a.duration ) * 100 ) );

    }

    _formatTime( seconds ) {

        const s = Math.max( 0, Math.floor( seconds ) );
        const m = Math.floor( s / 60 );
        const r = s % 60;
        return m > 0
            ? `${ m }m ${ String( r ).padStart( 2, '0' ) }s`
            : `${ r }s`;

    }

    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default Forensics;
