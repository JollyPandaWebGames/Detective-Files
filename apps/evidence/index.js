/**
 * Evidence Database
 *
 * Purpose:
 *   Central repository for every piece of evidence in an investigation.
 *   Displays, filters, and preserves player interaction with evidence.
 *
 * Layout:
 *   Desktop/Tablet — three panels: category sidebar | evidence list | detail
 *   Phone          — single-column with stacked navigation
 *
 * Data:
 *   Evidence is loaded per-case by EvidenceManager.
 *   Player state (pins, notes, lastViewed) persists via StorageManager.
 *
 * Events consumed:
 *   case:selected          — reload evidence for the new case
 *   evidence:loaded        — re-render list after load completes
 *   evidence:pinned        — refresh list to re-sort pinned items
 *   evidence:note-updated  — (no-op — notes autosave locally in app)
 *   mail:attachment-opened — focus the matching evidence item
 *
 * Rules:
 *   Never access localStorage directly.
 *   Never call other applications directly — use EventBus.
 */

import BaseApp         from '../../core/BaseApp.js';
import EventBus        from '../../core/EventBus.js';
import EvidenceManager from '../../managers/EvidenceManager.js';

// Category sidebar entries.
const CATEGORIES = [
    { id: 'all',               label: 'All Evidence',     emoji: '🔍' },
    { id: 'Physical Evidence', label: 'Physical Evidence', emoji: '🧳' },
    { id: 'Documents',         label: 'Documents',         emoji: '📄' },
    { id: 'Photographs',       label: 'Photographs',       emoji: '📸' },
    { id: 'Digital Files',     label: 'Digital Files',     emoji: '💾' },
    { id: 'Fingerprints',      label: 'Fingerprints',      emoji: '👆' },
    { id: 'DNA',               label: 'DNA',               emoji: '🧬' },
    { id: 'Other',             label: 'Other',             emoji: '📦' },
];

const STATUS_CLASS = {
    'Collected':  'ev-status--collected',
    'Analyzed':   'ev-status--analyzed',
    'Transferred':'ev-status--transferred',
    'Archived':   'ev-status--archived',
};

const PREVIEW_EMOJI = {
    document:    '📄',
    image:       '🖼️',
    fingerprint: '👆',
    dna:         '🧬',
    video:       '📹',
    object:      '🧳',
};

// Notes autosave debounce delay in milliseconds.
const NOTES_SAVE_DELAY = 800;

class Evidence extends BaseApp {

    constructor( config ) {
        super( config );

        /** Currently selected category. @type {string} */
        this._activeCategory = 'all';

        /** Currently selected evidence id. @type {string|null} */
        this._selectedId = null;

        /** Current search query. @type {string} */
        this._searchQuery = '';

        /** Current status filter. @type {string} */
        this._statusFilter = 'all';

        /** Active case id. @type {string|null} */
        this._activeCaseId = null;

        // DOM refs.
        this._sidebarEl   = null;
        this._listEl      = null;
        this._detailEl    = null;
        this._searchInput = null;
        this._statusSelect = null;

        // Notes autosave timer.
        this._notesSaveTimer = null;

        // Bound EventBus handlers.
        this._onCaseSelected       = ( { case: c } ) => this._handleCaseSelected( c );
        this._onEvidenceLoaded     = ()              => this._refreshList();
        this._onEvidencePinned     = ()              => this._refreshList();
        this._onAttachmentOpened   = ( { attachmentId } ) => this._focusByAttachment( attachmentId );
        this._onFocusRequest       = ( { evidenceId }   ) => this._focusByAttachment( null, evidenceId );

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {

        contentEl.classList.add( 'ev' );
        this._buildLayout( contentEl );

    }

    open() {

        EventBus.on( 'case:selected',          this._onCaseSelected     );
        EventBus.on( 'evidence:loaded',         this._onEvidenceLoaded   );
        EventBus.on( 'evidence:pinned',         this._onEvidencePinned   );
        EventBus.on( 'mail:attachment-opened',  this._onAttachmentOpened );
        EventBus.on( 'evidence:focus-request',  this._onFocusRequest     );

        // Restore last active case and evidence if reopened.
        if ( this._activeCaseId ) {
            this._refreshList();
        }
        else {
            this._renderEmptyList( 'Select a case from Case Management to view evidence.' );
        }

    }

    close() {

        EventBus.off( 'case:selected',         this._onCaseSelected     );
        EventBus.off( 'evidence:loaded',        this._onEvidenceLoaded   );
        EventBus.off( 'evidence:pinned',        this._onEvidencePinned   );
        EventBus.off( 'mail:attachment-opened', this._onAttachmentOpened );
        EventBus.off( 'evidence:focus-request', this._onFocusRequest     );

        clearTimeout( this._notesSaveTimer );

    }

    minimize() {}
    restore()  { this._refreshList(); }

    destroy() {
        clearTimeout( this._notesSaveTimer );
        this._sidebarEl    = null;
        this._listEl       = null;
        this._detailEl     = null;
        this._searchInput  = null;
        this._statusSelect = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    _buildLayout( contentEl ) {

        // ── Sidebar ──────────────────────────────────────────────
        this._sidebarEl = document.createElement( 'nav' );
        this._sidebarEl.className = 'ev__sidebar';
        this._sidebarEl.setAttribute( 'aria-label', 'Evidence categories' );

        CATEGORIES.forEach( cat => {
            const btn = document.createElement( 'button' );
            btn.className      = 'ev__cat-btn';
            btn.dataset.cat    = cat.id;
            btn.setAttribute( 'type', 'button' );
            btn.innerHTML = `
                <span class="ev__cat-emoji">${ cat.emoji }</span>
                <span class="ev__cat-label">${ cat.label }</span>
                <span class="ev__cat-count" data-cat-count="${ cat.id }"></span>
            `;
            btn.addEventListener( 'click', () => this._selectCategory( cat.id ) );
            this._sidebarEl.appendChild( btn );
        } );

        // ── List Panel ────────────────────────────────────────────
        const listPanel = document.createElement( 'div' );
        listPanel.className = 'ev__list-panel';

        const filterBar = document.createElement( 'div' );
        filterBar.className = 'ev__filter-bar';

        this._searchInput = document.createElement( 'input' );
        this._searchInput.type        = 'text';
        this._searchInput.className   = 'ev__search-input';
        this._searchInput.placeholder = 'Search evidence...';
        this._searchInput.setAttribute( 'aria-label', 'Search evidence' );
        this._searchInput.addEventListener( 'input', () => {
            this._searchQuery = this._searchInput.value;
            this._refreshList();
        } );

        this._statusSelect = document.createElement( 'select' );
        this._statusSelect.className = 'ev__status-select';
        this._statusSelect.setAttribute( 'aria-label', 'Filter by status' );
        [ 'all', 'Collected', 'Analyzed', 'Transferred', 'Archived' ].forEach( s => {
            const opt = document.createElement( 'option' );
            opt.value       = s;
            opt.textContent = s === 'all' ? 'All Statuses' : s;
            this._statusSelect.appendChild( opt );
        } );
        this._statusSelect.addEventListener( 'change', () => {
            this._statusFilter = this._statusSelect.value;
            this._refreshList();
        } );

        filterBar.appendChild( this._searchInput );
        filterBar.appendChild( this._statusSelect );

        this._listEl = document.createElement( 'div' );
        this._listEl.className = 'ev__list';
        this._listEl.setAttribute( 'role', 'list' );

        listPanel.appendChild( filterBar );
        listPanel.appendChild( this._listEl );

        // ── Detail Panel ─────────────────────────────────────────
        this._detailEl = document.createElement( 'div' );
        this._detailEl.className = 'ev__detail';
        this._detailEl.setAttribute( 'aria-live', 'polite' );
        this._renderEmptyDetail();

        contentEl.appendChild( this._sidebarEl );
        contentEl.appendChild( listPanel );
        contentEl.appendChild( this._detailEl );

        this._updateCategoryActiveState();

    }

    // ─────────────────────────────────────────────────────────────
    // Case / Category / List
    // ─────────────────────────────────────────────────────────────

    _handleCaseSelected( c ) {

        this._activeCaseId   = c.id;
        this._selectedId     = null;
        this._activeCategory = 'all';
        this._searchQuery    = '';
        this._statusFilter   = 'all';

        if ( this._searchInput  ) this._searchInput.value    = '';
        if ( this._statusSelect ) this._statusSelect.value   = 'all';

        this._renderEmptyDetail();
        this._renderEmptyList( 'Loading evidence...' );

        EvidenceManager.loadForCase( c.id );

    }

    _selectCategory( catId ) {

        this._activeCategory = catId;
        this._updateCategoryActiveState();
        this._refreshList();

        if ( this._detailEl ) {
            this._detailEl.classList.remove( 'ev__detail--phone-active' );
        }

    }

    _updateCategoryActiveState() {

        if ( !this._sidebarEl ) return;

        const all = Array.from( this._listEl?.querySelectorAll?.( '.ev__list-item' ) ?? [] );
        const allItems = EvidenceManager.getByCategory( 'all' );

        this._sidebarEl.querySelectorAll( '.ev__cat-btn' ).forEach( btn => {
            const catId   = btn.dataset.cat;
            const isActive = catId === this._activeCategory;
            btn.classList.toggle( 'ev__cat-btn--active', isActive );

            const countEl = btn.querySelector( `[data-cat-count]` );
            if ( countEl ) {
                const count = catId === 'all'
                    ? allItems.length
                    : allItems.filter( e => e.category === catId ).length;
                countEl.textContent = count > 0 ? String( count ) : '';
            }
        } );

    }

    _refreshList() {

        if ( !this._listEl ) return;

        let items = this._searchQuery.trim()
            ? EvidenceManager.search( this._searchQuery )
            : EvidenceManager.getByCategory( this._activeCategory );

        items = EvidenceManager.filterByStatus( items, this._statusFilter );

        this._listEl.innerHTML = '';

        if ( items.length === 0 ) {
            this._renderEmptyList(
                this._activeCaseId
                    ? 'No evidence matches your filters.'
                    : 'Select a case from Case Management to view evidence.'
            );
            this._updateCategoryActiveState();
            return;
        }

        items.forEach( e => this._listEl.appendChild( this._buildListItem( e ) ) );
        this._updateCategoryActiveState();

        if ( this._selectedId ) {
            const el = this._listEl.querySelector( `[data-ev-id="${ this._selectedId }"]` );
            if ( el ) el.classList.add( 'ev__list-item--selected' );
        }

    }

    _renderEmptyList( msg ) {

        if ( !this._listEl ) return;
        this._listEl.innerHTML = `<div class="ev__list-empty">${ this._escape( msg ) }</div>`;

    }

    _buildListItem( e ) {

        const item = document.createElement( 'div' );
        item.className = 'ev__list-item';
        item.dataset.evId = e.id;
        item.setAttribute( 'role', 'listitem' );
        item.setAttribute( 'tabindex', '0' );

        const statusClass = STATUS_CLASS[ e.status ] ?? '';
        const previewEmoji = PREVIEW_EMOJI[ e.type ] ?? '📦';

        item.innerHTML = `
            <div class="ev__list-item-thumb">${ e.favorite ? '📌' : previewEmoji }</div>
            <div class="ev__list-item-body">
                <div class="ev__list-item-id">${ this._escape( e.id ) }</div>
                <div class="ev__list-item-title">${ this._escape( e.title ) }</div>
                <div class="ev__list-item-meta">
                    <span class="ev-status-badge ${ statusClass }">${ e.status }</span>
                    <span class="ev__list-item-cat">${ this._escape( e.category ) }</span>
                </div>
            </div>
        `;

        item.addEventListener( 'click', () => this._selectEvidence( e.id ) );
        item.addEventListener( 'keydown', ( evt ) => {
            if ( evt.key === 'Enter' || evt.key === ' ' ) {
                evt.preventDefault();
                this._selectEvidence( e.id );
            }
        } );

        return item;

    }

    // ─────────────────────────────────────────────────────────────
    // Detail
    // ─────────────────────────────────────────────────────────────

    _selectEvidence( id ) {

        const e = EvidenceManager.getById( id );
        if ( !e ) return;

        this._selectedId = id;

        this._listEl.querySelectorAll( '.ev__list-item' ).forEach( el => {
            el.classList.toggle( 'ev__list-item--selected', el.dataset.evId === id );
        } );

        this._renderDetail( e );
        EvidenceManager.markLastViewed( id );

        EventBus.emit( 'evidence:selected', { evidence: e } );
        EventBus.emit( 'evidence:opened',   { evidenceId: id } );

        if ( this._detailEl ) {
            this._detailEl.classList.add( 'ev__detail--phone-active' );
        }

    }

    _renderDetail( e ) {

        if ( !this._detailEl ) return;

        const statusClass  = STATUS_CLASS[ e.status ] ?? '';
        const previewEmoji = PREVIEW_EMOJI[ e.type ] ?? '📦';

        this._detailEl.innerHTML = `
            <div class="ev__detail-toolbar">
                <button type="button" class="ev__detail-back">← Back</button>
                <div class="ev__detail-actions"></div>
            </div>

            <div class="ev__detail-preview">
                <div class="ev__detail-preview-icon">${ previewEmoji }</div>
                <div class="ev__detail-preview-label">${ this._escape( e.category ) }</div>
            </div>

            <div class="ev__detail-id">${ this._escape( e.id ) }</div>
            <div class="ev__detail-title">${ this._escape( e.title ) }</div>

            <div class="ev__detail-badges">
                <span class="ev-status-badge ${ statusClass }">${ e.status }</span>
            </div>

            <div class="ev__detail-section-label">Description</div>
            <div class="ev__detail-description"></div>

            <div class="ev__detail-section-label">Details</div>
            <div class="ev__detail-fields">
                ${ this._buildField( 'Location Found', e.location ) }
                ${ this._buildField( 'Collected By',   e.collectedBy ) }
                ${ this._buildField( 'Date',           e.date ) }
            </div>

            <div class="ev__detail-section-label">Tags</div>
            <div class="ev__detail-tags"></div>

            <div class="ev__detail-section-label">Chain of Custody</div>
            <div class="ev__detail-chain"></div>

            <div class="ev__detail-section-label">Related Evidence</div>
            <div class="ev__detail-related"></div>

            <div class="ev__detail-section-label">Investigation Notes</div>
            <textarea class="ev__detail-notes" placeholder="Write your notes here..." rows="4"></textarea>
        `;

        // Description.
        this._detailEl.querySelector( '.ev__detail-description' ).textContent = e.description ?? '';

        // Actions.
        const actionsEl = this._detailEl.querySelector( '.ev__detail-actions' );
        const pinBtn = document.createElement( 'button' );
        pinBtn.className   = 'ev__action-btn';
        pinBtn.textContent = e.favorite ? '📌 Unpin' : '📌 Pin as Important';
        pinBtn.setAttribute( 'type', 'button' );
        pinBtn.addEventListener( 'click', () => {
            EvidenceManager.togglePin( e.id );
            // Re-render with updated state.
            this._renderDetail( EvidenceManager.getById( e.id ) );
        } );
        actionsEl.appendChild( pinBtn );

        // Tags.
        const tagsEl = this._detailEl.querySelector( '.ev__detail-tags' );
        if ( e.tags?.length ) {
            e.tags.forEach( t => {
                const chip = document.createElement( 'span' );
                chip.className   = 'ev__tag-chip';
                chip.textContent = t;
                tagsEl.appendChild( chip );
            } );
        }
        else {
            tagsEl.innerHTML = '<span class="ev__empty-field">No tags</span>';
        }

        // Chain of custody.
        const chainEl = this._detailEl.querySelector( '.ev__detail-chain' );
        ( e.chainOfCustody ?? [] ).forEach( ( entry, i ) => {
            const row = document.createElement( 'div' );
            row.className = 'ev__chain-row';
            row.innerHTML = `
                <span class="ev__chain-step">${ i + 1 }</span>
                <div class="ev__chain-info">
                    <span class="ev__chain-stage">${ this._escape( entry.stage ) }</span>
                    <span class="ev__chain-meta">${ this._escape( entry.by ) } — ${ this._escape( entry.date ) }</span>
                </div>
            `;
            chainEl.appendChild( row );
        } );

        if ( !e.chainOfCustody?.length ) {
            chainEl.innerHTML = '<span class="ev__empty-field">No chain of custody recorded.</span>';
        }

        // Related evidence.
        const relatedEl = this._detailEl.querySelector( '.ev__detail-related' );
        if ( e.related?.length ) {
            e.related.forEach( relId => {
                const rel = EvidenceManager.getById( relId );
                const btn = document.createElement( 'button' );
                btn.className   = 'ev__related-btn';
                btn.setAttribute( 'type', 'button' );
                btn.innerHTML = `<span>${ this._escape( relId ) }</span><span>${ rel ? this._escape( rel.title ) : '—' }</span>`;
                btn.addEventListener( 'click', () => {
                    if ( rel ) this._selectEvidence( relId );
                } );
                relatedEl.appendChild( btn );
            } );
        }
        else {
            relatedEl.innerHTML = '<span class="ev__empty-field">No related evidence.</span>';
        }

        // Notes textarea — populate + autosave.
        const notesEl = this._detailEl.querySelector( '.ev__detail-notes' );
        notesEl.value = e.notes ?? '';
        notesEl.addEventListener( 'input', () => {
            clearTimeout( this._notesSaveTimer );
            this._notesSaveTimer = setTimeout( () => {
                EvidenceManager.saveNotes( e.id, notesEl.value );
            }, NOTES_SAVE_DELAY );
        } );

        // Back button — phone.
        this._detailEl.querySelector( '.ev__detail-back' )
            .addEventListener( 'click', () => {
                this._detailEl.classList.remove( 'ev__detail--phone-active' );
            } );

    }

    _renderEmptyDetail() {

        if ( !this._detailEl ) return;

        this._detailEl.innerHTML = `
            <div class="ev__detail-empty">
                <div class="ev__detail-empty-emoji">🔍</div>
                <div class="ev__detail-empty-text">Select an evidence item to view details</div>
            </div>
        `;

    }

    // ─────────────────────────────────────────────────────────────
    // Mail Integration
    // ─────────────────────────────────────────────────────────────

    /**
     * Focus the evidence item linked to a mail attachment.
     * Called when 'mail:attachment-opened' is emitted from Police Mail.
     *
     * @param {string} attachmentId
     * @returns {void}
     */
    _focusByAttachment( attachmentId, evidenceId ) {

        const item = evidenceId
            ? EvidenceManager.getById( evidenceId )
            : EvidenceManager.getByAttachmentId( attachmentId );

        if ( !item ) return;

        this._selectEvidence( item.id );

        // Scroll list item into view and flash.
        const el = this._listEl.querySelector( `[data-ev-id="${ item.id }"]` );
        if ( el ) {
            el.scrollIntoView( { block: 'nearest' } );
            el.classList.add( 'ev__list-item--highlight-flash' );
            setTimeout( () => el.classList.remove( 'ev__list-item--highlight-flash' ), 1200 );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    _buildField( label, value ) {
        return `
            <div class="ev__detail-field">
                <span class="ev__detail-field-label">${ label }</span>
                <span class="ev__detail-field-value">${ this._escape( value ?? '—' ) }</span>
            </div>
        `;
    }

    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default Evidence;
