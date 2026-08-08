/**
 * CaseManagement
 *
 * Purpose:
 *   The central hub of Detective Files. Every investigation begins here.
 *   Browse, filter, and start cases. Progress persists locally.
 *
 * Layout:
 *   Desktop/Tablet — three panels: folder sidebar | case list | case details
 *   Phone          — single column with bottom navigation between views
 *
 * Data:
 *   All cases loaded once at boot by CaseManager (data/cases/*.json).
 *   Status/progress persisted via StorageManager.
 *
 * Events consumed:
 *   case:loaded    — refresh list once data arrives
 *   case:progress  — keep detail panel in sync if progress changes elsewhere
 *
 * Architecture (see ARCHITECTURE_2.md, Epic 01 & 01.1):
 *   Selecting a row in the list is a purely local UI concern (detail
 *   panel preview + highlight) and does not broadcast to the rest of
 *   the workstation. Only starting/continuing an investigation via
 *   context.startInvestigation() changes the Active Investigation and
 *   causes every other application to refresh via 'investigationChanged'
 *   — CaseManager.startCase() is never called directly from here.
 *
 *   Per Epic 01.1 §8, starting a different investigation while one is
 *   already Active is blocked outright (Start/Continue is disabled with
 *   an inline message) — there is no confirm-and-override dialog.
 *   Case Management is the only application responsible for
 *   starting/stopping investigations; no other application depends on it.
 *
 * Rules:
 *   Never access localStorage directly — use CaseManager / StorageManager.
 *   Never call other applications directly — use EventBus.
 */

import BaseApp     from '../../core/BaseApp.js';
import EventBus    from '../../core/EventBus.js';
import CaseManager from '../../managers/CaseManager.js';

// Folder definitions — order determines sidebar order.
const FOLDERS = [
    { id: 'active',   label: 'Active Cases', emoji: '🗂️' },
    { id: 'solved',   label: 'Solved Cases', emoji: '✅' },
    { id: 'archived', label: 'Archived',     emoji: '🗄️' },
];

const DIFFICULTY_CLASS = {
    'Very Easy': 'case-difficulty--very-easy',
    Easy:        'case-difficulty--easy',
    Medium:      'case-difficulty--medium',
    Hard:        'case-difficulty--hard',
};

const STATUS_CLASS = {
    'Unlocked':    'case-status--unlocked',
    'In Progress': 'case-status--in-progress',
    'Solved':      'case-status--solved',
    'Locked':      'case-status--locked',
    'Archived':    'case-status--archived',
};

class CaseManagement extends BaseApp {

    constructor( config ) {
        super( config );

        /** Currently selected folder id. @type {string} */
        this._activeFolder = 'active';

        /** Currently selected case id. @type {string|null} */
        this._selectedCaseId = null;

        /** Current search query. @type {string} */
        this._searchQuery = '';

        /** Current difficulty filter ('all' | 'Easy' | 'Medium' | 'Hard'). @type {string} */
        this._difficultyFilter = 'all';

        // DOM refs.
        this._sidebarEl    = null;
        this._listEl       = null;
        this._detailEl     = null;
        this._searchInput  = null;
        this._difficultySelect = null;

        // Bound EventBus handlers — stored for clean removal in close().
        this._onCaseLoaded   = () => this._refreshList();
        this._onCaseProgress = ( { caseId } ) => {
            if ( caseId === this._selectedCaseId ) this._renderDetail( CaseManager.getById( caseId ) );
        };

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {

        contentEl.classList.add( 'casemgmt' );
        this._buildLayout( contentEl );

    }

    open() {

        EventBus.on( 'case:loaded',   this._onCaseLoaded   );
        EventBus.on( 'case:progress', this._onCaseProgress );

        this._refreshList();

    }

    close() {

        EventBus.off( 'case:loaded',   this._onCaseLoaded   );
        EventBus.off( 'case:progress', this._onCaseProgress );

    }

    minimize() {}
    restore()  { this._refreshList(); }

    destroy() {
        this._sidebarEl   = null;
        this._listEl      = null;
        this._detailEl    = null;
        this._searchInput = null;
        this._difficultySelect = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the three-panel (or responsive single-column) layout.
     *
     * @param {HTMLElement} contentEl
     * @returns {void}
     */
    _buildLayout( contentEl ) {

        // ── Sidebar ──────────────────────────────────────────────
        this._sidebarEl = document.createElement( 'nav' );
        this._sidebarEl.className = 'casemgmt__sidebar';
        this._sidebarEl.setAttribute( 'aria-label', 'Case folders' );

        FOLDERS.forEach( folder => {
            const btn = document.createElement( 'button' );
            btn.className      = 'casemgmt__folder-btn';
            btn.dataset.folder = folder.id;
            btn.setAttribute( 'type', 'button' );
            btn.innerHTML = `
                <span class="casemgmt__folder-emoji">${ folder.emoji }</span>
                <span class="casemgmt__folder-label">${ folder.label }</span>
                <span class="casemgmt__folder-count" data-folder-count="${ folder.id }"></span>
            `;
            btn.addEventListener( 'click', () => this._selectFolder( folder.id ) );
            this._sidebarEl.appendChild( btn );
        } );

        // ── List Panel (filters + case list) ───────────────────────
        const listPanel = document.createElement( 'div' );
        listPanel.className = 'casemgmt__list-panel';

        const filterBar = document.createElement( 'div' );
        filterBar.className = 'casemgmt__filter-bar';

        this._searchInput = document.createElement( 'input' );
        this._searchInput.type        = 'text';
        this._searchInput.className   = 'casemgmt__search-input';
        this._searchInput.placeholder = 'Search cases...';
        this._searchInput.setAttribute( 'aria-label', 'Search cases by title' );
        this._searchInput.addEventListener( 'input', () => {
            this._searchQuery = this._searchInput.value;
            this._refreshList();
        } );

        this._difficultySelect = document.createElement( 'select' );
        this._difficultySelect.className = 'casemgmt__difficulty-select';
        this._difficultySelect.setAttribute( 'aria-label', 'Filter by difficulty' );
        [ 'all', 'Very Easy', 'Easy', 'Medium', 'Hard' ].forEach( level => {
            const opt = document.createElement( 'option' );
            opt.value       = level;
            opt.textContent = level === 'all' ? 'All Difficulties' : level;
            this._difficultySelect.appendChild( opt );
        } );
        this._difficultySelect.addEventListener( 'change', () => {
            this._difficultyFilter = this._difficultySelect.value;
            this._refreshList();
        } );

        filterBar.appendChild( this._searchInput );
        filterBar.appendChild( this._difficultySelect );

        this._listEl = document.createElement( 'div' );
        this._listEl.className = 'casemgmt__list';
        this._listEl.setAttribute( 'role', 'list' );

        listPanel.appendChild( filterBar );
        listPanel.appendChild( this._listEl );

        // ── Detail Panel ─────────────────────────────────────────
        this._detailEl = document.createElement( 'div' );
        this._detailEl.className = 'casemgmt__detail';
        this._detailEl.setAttribute( 'aria-live', 'polite' );
        this._renderEmptyDetail();

        // ── Assemble ─────────────────────────────────────────────
        contentEl.appendChild( this._sidebarEl );
        contentEl.appendChild( listPanel );
        contentEl.appendChild( this._detailEl );

        this._updateFolderActiveState();

    }

    // ─────────────────────────────────────────────────────────────
    // Folder / List
    // ─────────────────────────────────────────────────────────────

    /**
     * Select a folder and refresh the list.
     *
     * @param {string} folderId
     * @returns {void}
     */
    _selectFolder( folderId ) {

        this._activeFolder = folderId;

        this._updateFolderActiveState();
        this._refreshList();

        // Phone: navigate back to list view.
        if ( this._detailEl ) {
            this._detailEl.classList.remove( 'casemgmt__detail--phone-active' );
        }

    }

    /**
     * Update sidebar button active states and per-folder counts.
     *
     * @returns {void}
     */
    _updateFolderActiveState() {

        if ( !this._sidebarEl ) return;

        this._sidebarEl.querySelectorAll( '.casemgmt__folder-btn' ).forEach( btn => {
            const isActive = btn.dataset.folder === this._activeFolder;
            btn.classList.toggle( 'casemgmt__folder-btn--active', isActive );

            const countEl = btn.querySelector( '[data-folder-count]' );
            if ( countEl ) {
                const count = CaseManager.getFolder( btn.dataset.folder ).length;
                countEl.textContent = count > 0 ? String( count ) : '';
            }
        } );

    }

    /**
     * Re-fetch the current folder/search/filter results and re-render the list.
     *
     * @returns {void}
     */
    _refreshList() {

        if ( !this._listEl ) return;

        let cases = this._searchQuery.trim()
            ? CaseManager.search( this._searchQuery )
            : CaseManager.getFolder( this._activeFolder );

        cases = CaseManager.filterByDifficulty( cases, this._difficultyFilter );

        this._listEl.innerHTML = '';

        if ( cases.length === 0 ) {
            const empty = document.createElement( 'div' );
            empty.className   = 'casemgmt__list-empty';
            empty.textContent = this._searchQuery
                ? 'No cases match your search.'
                : 'No cases in this folder.';
            this._listEl.appendChild( empty );
            this._updateFolderActiveState();
            return;
        }

        cases.forEach( c => {
            this._listEl.appendChild( this._buildListItem( c ) );
        } );

        this._updateFolderActiveState();

        if ( this._selectedCaseId ) {
            const el = this._listEl.querySelector( `[data-case-id="${ this._selectedCaseId }"]` );
            if ( el ) el.classList.add( 'casemgmt__list-item--selected' );
        }

    }

    /**
     * Build a single case list item.
     *
     * @param {Object} c
     * @returns {HTMLElement}
     */
    _buildListItem( c ) {

        const item = document.createElement( 'div' );
        item.className = 'casemgmt__list-item';
        item.dataset.caseId = c.id;
        item.setAttribute( 'role', 'listitem' );
        item.setAttribute( 'tabindex', '0' );

        const isLocked = c.status === 'Locked';
        if ( isLocked ) item.classList.add( 'casemgmt__list-item--locked' );

        const diffClass   = DIFFICULTY_CLASS[ c.difficulty ] ?? '';
        const statusClass = STATUS_CLASS[ c.status ] ?? '';

        item.innerHTML = `
            <div class="casemgmt__list-item-thumb">
                ${ isLocked ? '🔒' : '📁' }
            </div>
            <div class="casemgmt__list-item-body">
                <div class="casemgmt__list-item-title">${ this._escape( c.title ) }</div>
                <div class="casemgmt__list-item-meta">
                    <span class="case-difficulty-badge ${ diffClass }">${ c.difficulty }</span>
                    <span class="case-status-badge ${ statusClass }">${ c.status }</span>
                </div>
                <div class="casemgmt__list-item-sub">
                    ⏱ ${ this._escape( c.estimatedTime ) } &nbsp;•&nbsp; 🏆 ${ c.reward }
                </div>
                ${ c.status === 'In Progress'
                    ? `<div class="casemgmt__list-item-progress">
                           <div class="casemgmt__list-item-progress-fill" style="width:${ c.progress ?? 0 }%"></div>
                       </div>`
                    : '' }
            </div>
        `;

        item.addEventListener( 'click', () => this._selectCase( c.id ) );
        item.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Enter' || e.key === ' ' ) {
                e.preventDefault();
                this._selectCase( c.id );
            }
        } );

        return item;

    }

    // ─────────────────────────────────────────────────────────────
    // Case Selection / Detail
    // ─────────────────────────────────────────────────────────────

    /**
     * Select a case and render its details.
     *
     * @param {string} caseId
     * @returns {void}
     */
    _selectCase( caseId ) {

        const c = CaseManager.getById( caseId );
        if ( !c ) return;

        this._selectedCaseId = caseId;

        this._listEl.querySelectorAll( '.casemgmt__list-item' ).forEach( el => {
            el.classList.toggle( 'casemgmt__list-item--selected', el.dataset.caseId === caseId );
        } );

        this._renderDetail( c );

        // Architecture: row selection is local preview only. The rest
        // of the workstation reacts to context.startInvestigation(), not
        // to browsing the list — see class doc for rationale.

        // Phone: navigate to detail view.
        if ( this._detailEl ) {
            this._detailEl.classList.add( 'casemgmt__detail--phone-active' );
        }

    }

    /**
     * Render the full detail panel for a selected case.
     *
     * @param {Object} c
     * @returns {void}
     */
    _renderDetail( c ) {

        if ( !this._detailEl || !c ) return;

        const isLocked     = c.status === 'Locked';
        const diffClass    = DIFFICULTY_CLASS[ c.difficulty ] ?? '';
        const statusClass  = STATUS_CLASS[ c.status ] ?? '';
        const canStart     = c.status === 'Unlocked';
        const inProgress   = c.status === 'In Progress';

        const activeInv         = this.context.getActiveInvestigation();
        const isActiveSession   = !!activeInv && activeInv.caseId === c.id;
        const blockedByOther    = !!activeInv && !isActiveSession;

        this._detailEl.innerHTML = `
            <div class="casemgmt__detail-toolbar">
                <button type="button" class="casemgmt__detail-back" aria-label="Back to list">← Back</button>
            </div>

            <div class="casemgmt__detail-thumb">${ isLocked ? '🔒' : '🗂️' }</div>

            <div class="casemgmt__detail-title">${ this._escape( c.title ) }</div>

            <div class="casemgmt__detail-badges">
                <span class="case-difficulty-badge ${ diffClass }">${ c.difficulty }</span>
                <span class="case-status-badge ${ statusClass }">${ c.status }</span>
            </div>

            <div class="casemgmt__detail-stats">
                <div class="casemgmt__detail-stat">
                    <span class="casemgmt__detail-stat-label">Estimated Time</span>
                    <span class="casemgmt__detail-stat-value">${ this._escape( c.estimatedTime ) }</span>
                </div>
                <div class="casemgmt__detail-stat">
                    <span class="casemgmt__detail-stat-label">Reward</span>
                    <span class="casemgmt__detail-stat-value">🏆 ${ c.reward }</span>
                </div>
            </div>

            ${ inProgress ? `
                <div class="casemgmt__detail-progress-wrap">
                    <div class="casemgmt__detail-progress-label">Progress: ${ c.progress ?? 0 }%</div>
                    <div class="casemgmt__detail-progress-track">
                        <div class="casemgmt__detail-progress-fill" style="width:${ c.progress ?? 0 }%"></div>
                    </div>
                </div>
            ` : '' }

            <div class="casemgmt__detail-section-label">Description</div>
            <div class="casemgmt__detail-description"></div>

            <div class="casemgmt__detail-section-label">Objectives</div>
            <div class="casemgmt__detail-objectives"></div>

            <div class="casemgmt__detail-action-wrap"></div>
        `;

        // Description — textContent for safety.
        this._detailEl.querySelector( '.casemgmt__detail-description' ).textContent = c.description ?? '';

        // Objectives.
        const objEl = this._detailEl.querySelector( '.casemgmt__detail-objectives' );
        ( c.objectives ?? [] ).forEach( obj => {
            const row = document.createElement( 'div' );
            row.className = 'casemgmt__objective';
            row.innerHTML = `<span class="casemgmt__objective-box">☐</span><span>${ this._escape( obj ) }</span>`;
            objEl.appendChild( row );
        } );

        // Action area.
        const actionWrap = this._detailEl.querySelector( '.casemgmt__detail-action-wrap' );

        if ( isLocked ) {
            const lockedMsg = document.createElement( 'div' );
            lockedMsg.className   = 'casemgmt__locked-message';
            lockedMsg.textContent = 'Complete previous investigations to unlock.';
            actionWrap.appendChild( lockedMsg );
        }
        else if ( blockedByOther ) {
            const blockedMsg = document.createElement( 'div' );
            blockedMsg.className   = 'casemgmt__locked-message';
            blockedMsg.textContent = 'Finish or stop the current investigation before starting another.';
            actionWrap.appendChild( blockedMsg );

            if ( canStart || inProgress ) {
                const disabledBtn = document.createElement( 'button' );
                disabledBtn.className  = 'casemgmt__start-btn';
                disabledBtn.textContent = canStart ? 'Start Investigation' : 'Continue Investigation';
                disabledBtn.setAttribute( 'type', 'button' );
                disabledBtn.disabled = true;
                actionWrap.appendChild( disabledBtn );
            }
        }
        else if ( canStart ) {
            const startBtn = document.createElement( 'button' );
            startBtn.className   = 'casemgmt__start-btn';
            startBtn.textContent  = 'Start Investigation';
            startBtn.setAttribute( 'type', 'button' );
            startBtn.addEventListener( 'click', () => this._startCase( c.id ) );
            actionWrap.appendChild( startBtn );
        }
        else if ( inProgress ) {

            const continueBtn = document.createElement( 'button' );
            continueBtn.className   = 'casemgmt__start-btn casemgmt__start-btn--continue';
            continueBtn.textContent  = 'Continue Investigation';
            continueBtn.setAttribute( 'type', 'button' );
            continueBtn.addEventListener( 'click', () => this._startCase( c.id ) );
            actionWrap.appendChild( continueBtn );

            if ( isActiveSession ) {
                const stopBtn = document.createElement( 'button' );
                stopBtn.className   = 'casemgmt__start-btn casemgmt__start-btn--stop';
                stopBtn.textContent  = 'Stop Investigation';
                stopBtn.setAttribute( 'type', 'button' );
                stopBtn.addEventListener( 'click', () => this._stopCase() );
                actionWrap.appendChild( stopBtn );
            }

        }
        else if ( c.status === 'Solved' ) {
            const solvedMsg = document.createElement( 'div' );
            solvedMsg.className   = 'casemgmt__solved-message';
            solvedMsg.textContent = '✅ This case has been solved.';
            actionWrap.appendChild( solvedMsg );
        }

        // Back button — phone navigation.
        this._detailEl.querySelector( '.casemgmt__detail-back' )
            .addEventListener( 'click', () => {
                this._detailEl.classList.remove( 'casemgmt__detail--phone-active' );
            } );

    }

    /**
     * Render the empty-state detail panel (no case selected).
     *
     * @returns {void}
     */
    _renderEmptyDetail() {

        if ( !this._detailEl ) return;

        this._detailEl.innerHTML = `
            <div class="casemgmt__detail-empty">
                <div class="casemgmt__detail-empty-emoji">🗂️</div>
                <div class="casemgmt__detail-empty-text">Select a case to view details</div>
            </div>
        `;

    }

    /**
     * Start (or continue) an investigation.
     *
     * Routed through ApplicationContext.startInvestigation() (Epic 01.1)
     * rather than calling CaseManager directly. If a different
     * investigation is already Active, the UI never reaches this point —
     * the Start/Continue button is disabled and replaced with a message
     * (see _renderDetail) instead of allowing a confirm-and-override.
     *
     * @param {string} caseId
     * @returns {void}
     */
    _startCase( caseId ) {

        const result = this.context.startInvestigation( caseId );
        if ( !result.ok ) return;

        this._refreshList();
        this._renderDetail( CaseManager.getById( caseId ) );

    }

    /**
     * Stop the active investigation. Every other open application must
     * react to 'investigationChanged' and fall back to its empty state —
     * see Epic 01.1 §10.
     *
     * @returns {void}
     */
    _stopCase() {

        const activeInv = this.context.getActiveInvestigation();
        if ( !activeInv ) return;

        this.context.stopInvestigation();

        this._refreshList();
        this._renderDetail( CaseManager.getById( activeInv.caseId ) );

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Escape HTML special characters to prevent injection from data.
     *
     * @param {string} str
     * @returns {string}
     */
    _escape( str ) {

        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;

    }

}

export default CaseManagement;
