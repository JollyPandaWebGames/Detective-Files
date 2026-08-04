/**
 * CriminalDatabase
 *
 * Purpose:
 *   Central repository for every person involved in an investigation.
 *   Browse profiles, search and filter, view relationships, follow
 *   cross-app links, and write detective notes.
 *
 * Layout:
 *   Desktop  — three panels: category sidebar | people list | profile detail
 *   Tablet   — collapsible sidebar
 *   Phone    — stacked navigation: categories → list → detail
 *
 * Data:
 *   People loaded per case by PeopleManager (data/cases/{id}/people/).
 *   Player state (pinned/notes/lastViewed) persists via StorageManager.
 *
 * Events consumed:
 *   investigationChanged — load people for the new investigation (Epic 01.1)
 *   person:loaded        — refresh list
 *   person:pinned        — refresh list (re-sort)
 *   person:focus-request — select and highlight a profile (cross-app)
 *
 * Events emitted:
 *   person:selected      — user selected a profile  { person }
 *   person:pinned        — via PeopleManager
 *   person:note-updated  — via PeopleManager
 */

import BaseApp       from '../../core/BaseApp.js';
import EventBus      from '../../core/EventBus.js';
import PeopleManager from '../../managers/PeopleManager.js';

const NOTES_DELAY = 800;

const ROLE_CATEGORIES = [
    { id: 'All',                 label: 'All People',        emoji: '👥' },
    { id: 'Suspect',             label: 'Suspects',          emoji: '🟠' },
    { id: 'Witness',             label: 'Witnesses',         emoji: '👤' },
    { id: 'Victim',              label: 'Victims',           emoji: '🔴' },
    { id: 'Officer',             label: 'Officers',          emoji: '🏛️' },
    { id: 'Detective',           label: 'Detectives',        emoji: '🔍' },
    { id: 'Person of Interest',  label: 'Persons of Interest', emoji: '🕵️' },
    { id: 'Unknown',             label: 'Unknown',           emoji: '❓' },
];

const STATUS_CLASS = {
    'Unknown':           'pdb-status--unknown',
    'Interview Pending': 'pdb-status--pending',
    'Interviewed':       'pdb-status--interviewed',
    'Suspect':           'pdb-status--suspect',
    'Cleared':           'pdb-status--cleared',
    'Arrested':          'pdb-status--arrested',
    'Missing':           'pdb-status--missing',
    'Deceased':          'pdb-status--deceased',
};

const RELATIONSHIP_EMOJI = {
    'Friend':           '🤝',
    'Family':           '👨‍👩‍👧',
    'Coworker':         '💼',
    'Colleague':        '🧑‍🤝‍🧑',
    'Employer':         '🏢',
    'Business Partner': '🤝',
    'Unknown':          '❓',
};

class CriminalDatabase extends BaseApp {

    constructor( config ) {
        super( config );

        /** @type {string} */
        this._activeRole   = 'All';
        /** @type {string|null} */
        this._selectedId   = null;
        /** @type {string|null} */
        this._activeCaseId = null;
        /** @type {string} */
        this._searchQuery  = '';
        /** @type {string} */
        this._statusFilter = 'all';

        // DOM refs.
        this._sidebarEl    = null;
        this._listEl       = null;
        this._detailEl     = null;
        this._searchInput  = null;
        this._statusSelect = null;

        // Notes autosave timer.
        this._notesTimer = null;

        // Bound EventBus handlers.
        this._onInvestigationChanged = ( { investigation } ) => this._syncInvestigation( investigation );
        this._onLoaded        = ()               => this._refreshList();
        this._onPinned        = ()               => this._refreshList();
        this._onFocusRequest  = ( { personId } ) => this._focusPerson( personId );

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {
        contentEl.classList.add( 'pdb' );
        this._buildLayout( contentEl );
    }

    open() {
        EventBus.on( 'investigationChanged', this._onInvestigationChanged );
        EventBus.on( 'person:loaded',       this._onLoaded       );
        EventBus.on( 'person:pinned',       this._onPinned       );
        EventBus.on( 'person:focus-request', this._onFocusRequest );
        this._syncInvestigation( this.context.getActiveInvestigation() );
    }

    close() {
        EventBus.off( 'investigationChanged', this._onInvestigationChanged );
        EventBus.off( 'person:loaded',       this._onLoaded       );
        EventBus.off( 'person:pinned',       this._onPinned       );
        EventBus.off( 'person:focus-request', this._onFocusRequest );
        clearTimeout( this._notesTimer );
    }

    minimize() {}
    restore()  { this._refreshList(); }

    destroy() {
        clearTimeout( this._notesTimer );
        this._sidebarEl   = null;
        this._listEl      = null;
        this._detailEl    = null;
        this._searchInput = null;
        this._statusSelect = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    _buildLayout( contentEl ) {

        // ── Left sidebar — categories ─────────────────────────────
        this._sidebarEl = document.createElement( 'nav' );
        this._sidebarEl.className = 'pdb__sidebar';
        this._sidebarEl.setAttribute( 'aria-label', 'People categories' );

        ROLE_CATEGORIES.forEach( cat => {
            const btn = document.createElement( 'button' );
            btn.className    = 'pdb__cat-btn';
            btn.dataset.role = cat.id;
            btn.setAttribute( 'type', 'button' );
            btn.innerHTML = `
                <span class="pdb__cat-emoji">${ cat.emoji }</span>
                <span class="pdb__cat-label">${ cat.label }</span>
                <span class="pdb__cat-count" data-cat-count="${ cat.id }"></span>
            `;
            btn.addEventListener( 'click', () => this._selectCategory( cat.id ) );
            this._sidebarEl.appendChild( btn );
        } );

        // ── List panel ────────────────────────────────────────────
        const listPanel = document.createElement( 'div' );
        listPanel.className = 'pdb__list-panel';

        const filterBar = document.createElement( 'div' );
        filterBar.className = 'pdb__filter-bar';

        this._searchInput = document.createElement( 'input' );
        this._searchInput.type        = 'text';
        this._searchInput.className   = 'pdb__search-input';
        this._searchInput.placeholder = 'Search people...';
        this._searchInput.setAttribute( 'aria-label', 'Search people' );
        this._searchInput.addEventListener( 'input', () => {
            this._searchQuery = this._searchInput.value;
            this._refreshList();
        } );

        this._statusSelect = document.createElement( 'select' );
        this._statusSelect.className = 'pdb__status-select';
        this._statusSelect.setAttribute( 'aria-label', 'Filter by status' );
        [ 'all', 'Unknown', 'Interview Pending', 'Interviewed', 'Suspect', 'Cleared', 'Arrested', 'Missing', 'Deceased' ]
            .forEach( s => {
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
        this._listEl.className = 'pdb__list';
        this._listEl.setAttribute( 'role', 'list' );

        listPanel.appendChild( filterBar );
        listPanel.appendChild( this._listEl );

        // ── Detail panel ─────────────────────────────────────────
        this._detailEl = document.createElement( 'div' );
        this._detailEl.className = 'pdb__detail';
        this._detailEl.setAttribute( 'aria-live', 'polite' );
        this._renderEmptyDetail();

        contentEl.appendChild( this._sidebarEl );
        contentEl.appendChild( listPanel );
        contentEl.appendChild( this._detailEl );

        this._updateSidebarCounts();

    }

    // ─────────────────────────────────────────────────────────────
    // Category / List
    // ─────────────────────────────────────────────────────────────

    _syncInvestigation( investigation ) {

        if ( !investigation ) {
            this._activeCaseId = null;
            this._renderEmptyDetail();
            this._refreshList();
            return;
        }

        if ( this._activeCaseId === investigation.caseId ) {
            this._refreshList();
            return;
        }

        this._activeCaseId = investigation.caseId;
        this._selectedId   = null;
        this._activeRole   = 'All';
        this._searchQuery  = '';
        this._statusFilter = 'all';
        if ( this._searchInput  ) this._searchInput.value    = '';
        if ( this._statusSelect ) this._statusSelect.value   = 'all';
        this._renderEmptyDetail();
        PeopleManager.loadForCase( investigation.caseId );
    }

    _selectCategory( role ) {
        this._activeRole = role;
        this._updateSidebarCounts();
        this._refreshList();
        if ( this._detailEl ) this._detailEl.classList.remove( 'pdb__detail--phone-active' );
    }

    _updateSidebarCounts() {

        if ( !this._sidebarEl ) return;

        this._sidebarEl.querySelectorAll( '.pdb__cat-btn' ).forEach( btn => {
            const role     = btn.dataset.role;
            const isActive = role === this._activeRole;
            btn.classList.toggle( 'pdb__cat-btn--active', isActive );

            const countEl = btn.querySelector( '[data-cat-count]' );
            if ( countEl ) {
                const count = role === 'All'
                    ? PeopleManager.getAll().length
                    : PeopleManager.getByRole( role ).length;
                countEl.textContent = count > 0 ? String( count ) : '';
            }
        } );

    }

    _refreshList() {

        if ( !this._listEl ) return;

        if ( !this._activeCaseId ) {
            this._listEl.innerHTML = `<div class="pdb__list-empty">No active investigation.<br>Open Case Management and start an investigation.</div>`;
            this._updateSidebarCounts();
            return;
        }

        let people = this._searchQuery.trim()
            ? PeopleManager.search( this._searchQuery )
            : PeopleManager.getByRole( this._activeRole );

        if ( this._statusFilter !== 'all' ) {
            people = people.filter( p => p.status === this._statusFilter );
        }

        this._listEl.innerHTML = '';

        if ( people.length === 0 ) {
            this._listEl.innerHTML = `<div class="pdb__list-empty">${
                people.length === 0 && this._searchQuery
                    ? 'No people match your search.'
                    : 'No people in this category.'
            }</div>`;
            this._updateSidebarCounts();
            return;
        }

        people.forEach( p => this._listEl.appendChild( this._buildListItem( p ) ) );

        this._updateSidebarCounts();

        if ( this._selectedId ) {
            const el = this._listEl.querySelector( `[data-person-id="${ this._selectedId }"]` );
            if ( el ) el.classList.add( 'pdb__list-item--selected' );
        }

    }

    _buildListItem( p ) {

        const item = document.createElement( 'div' );
        item.className = 'pdb__list-item';
        item.dataset.personId = p.id;
        item.setAttribute( 'role', 'listitem' );
        item.setAttribute( 'tabindex', '0' );

        const statusClass = STATUS_CLASS[ p.status ] ?? '';

        item.innerHTML = `
            <div class="pdb__list-item-avatar">${ p.avatarEmoji ?? '👤' }${ p.pinned ? '<span class="pdb__list-pin">📌</span>' : '' }</div>
            <div class="pdb__list-item-body">
                <div class="pdb__list-item-name">${ this._escape( p.name ) }</div>
                <div class="pdb__list-item-meta">
                    <span class="pdb__list-item-role">${ this._escape( p.role ) }</span>
                    <span class="pdb-status-badge ${ statusClass }">${ p.status }</span>
                </div>
                <div class="pdb__list-item-occ">${ this._escape( p.occupation ?? '—' ) }</div>
            </div>
        `;

        item.addEventListener( 'click', () => this._selectPerson( p.id ) );
        item.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Enter' || e.key === ' ' ) {
                e.preventDefault();
                this._selectPerson( p.id );
            }
        } );

        return item;

    }

    // ─────────────────────────────────────────────────────────────
    // Profile Detail
    // ─────────────────────────────────────────────────────────────

    _selectPerson( personId ) {

        const p = PeopleManager.getById( personId );
        if ( !p ) return;

        this._selectedId = personId;

        this._listEl.querySelectorAll( '.pdb__list-item' ).forEach( el => {
            el.classList.toggle( 'pdb__list-item--selected', el.dataset.personId === personId );
        } );

        this._renderDetail( p );
        PeopleManager.markLastViewed( personId );

        EventBus.emit( 'person:selected', { person: p } );

        if ( this._detailEl ) this._detailEl.classList.add( 'pdb__detail--phone-active' );

    }

    _focusPerson( personId ) {

        const p = PeopleManager.getById( personId );
        if ( !p ) return;

        this._selectPerson( personId );

        const el = this._listEl.querySelector( `[data-person-id="${ personId }"]` );
        if ( el ) {
            el.scrollIntoView( { block: 'nearest' } );
            el.classList.add( 'pdb__list-item--flash' );
            setTimeout( () => el.classList.remove( 'pdb__list-item--flash' ), 1200 );
        }

    }

    _renderDetail( p ) {

        if ( !this._detailEl ) return;

        const statusClass = STATUS_CLASS[ p.status ] ?? '';

        this._detailEl.innerHTML = `
            <div class="pdb__detail-toolbar">
                <button type="button" class="pdb__detail-back">← Back</button>
                <div class="pdb__detail-actions"></div>
            </div>

            <div class="pdb__detail-avatar">${ p.avatarEmoji ?? '👤' }</div>
            <div class="pdb__detail-name">${ this._escape( p.name ) }</div>

            <div class="pdb__detail-badges">
                <span class="pdb__detail-role">${ this._escape( p.role ) }</span>
                <span class="pdb-status-badge ${ statusClass }">${ p.status }</span>
            </div>

            <div class="pdb__detail-fields">
                ${ this._field( 'Age',        p.age != null ? String( p.age ) : '—' ) }
                ${ this._field( 'Occupation', p.occupation ?? '—' ) }
                ${ this._field( 'Employer',   p.employer   ?? '—' ) }
            </div>

            <div class="pdb__detail-section">Description</div>
            <div class="pdb__detail-description"></div>

            <div class="pdb__detail-section">Known Aliases</div>
            <div class="pdb__detail-aliases"></div>

            <div class="pdb__detail-section">Known Addresses</div>
            <div class="pdb__detail-addresses"></div>

            <div class="pdb__detail-section">Relationships</div>
            <div class="pdb__detail-relationships"></div>

            <div class="pdb__detail-section">Quick Actions</div>
            <div class="pdb__detail-quick-actions"></div>

            <div class="pdb__detail-section">Investigation Notes</div>
            <textarea class="pdb__notes" placeholder="Notes about this person..."></textarea>
        `;

        // Description.
        this._detailEl.querySelector( '.pdb__detail-description' ).textContent = p.description ?? '';

        // Actions toolbar.
        const actionsEl = this._detailEl.querySelector( '.pdb__detail-actions' );
        const pinBtn = document.createElement( 'button' );
        pinBtn.className   = 'pdb__action-btn';
        pinBtn.textContent = p.pinned ? '📌 Unpin' : '📌 Pin';
        pinBtn.setAttribute( 'type', 'button' );
        pinBtn.addEventListener( 'click', () => {
            PeopleManager.togglePin( p.id );
            this._renderDetail( PeopleManager.getById( p.id ) );
        } );
        actionsEl.appendChild( pinBtn );

        // Aliases.
        const aliasesEl = this._detailEl.querySelector( '.pdb__detail-aliases' );
        if ( p.knownAliases?.length ) {
            p.knownAliases.forEach( a => {
                const chip = document.createElement( 'span' );
                chip.className   = 'pdb__tag-chip';
                chip.textContent = a;
                aliasesEl.appendChild( chip );
            } );
        }
        else {
            aliasesEl.innerHTML = '<span class="pdb__empty-field">None on record</span>';
        }

        // Addresses.
        const addrEl = this._detailEl.querySelector( '.pdb__detail-addresses' );
        if ( p.knownAddresses?.length ) {
            p.knownAddresses.forEach( a => {
                const row = document.createElement( 'div' );
                row.className   = 'pdb__address-row';
                row.textContent = a;
                addrEl.appendChild( row );
            } );
        }
        else {
            addrEl.innerHTML = '<span class="pdb__empty-field">None on record</span>';
        }

        // Relationships.
        const relEl = this._detailEl.querySelector( '.pdb__detail-relationships' );
        if ( p.relationships?.length ) {
            p.relationships.forEach( rel => {
                const related = PeopleManager.getById( rel.personId );
                const btn     = document.createElement( 'button' );
                btn.className = 'pdb__rel-btn';
                btn.setAttribute( 'type', 'button' );
                const emoji  = RELATIONSHIP_EMOJI[ rel.type ] ?? '🔗';
                btn.innerHTML = `
                    <span class="pdb__rel-type">${ emoji } ${ this._escape( rel.type ) }</span>
                    <span class="pdb__rel-name">${ this._escape( related?.name ?? rel.personId ) }</span>
                    <span class="pdb__rel-desc">${ this._escape( rel.description ?? '' ) }</span>
                `;
                btn.addEventListener( 'click', () => {
                    if ( related ) this._selectPerson( related.id );
                } );
                relEl.appendChild( btn );
            } );
        }
        else {
            relEl.innerHTML = '<span class="pdb__empty-field">No known relationships</span>';
        }

        // Quick actions.
        const qaEl = this._detailEl.querySelector( '.pdb__detail-quick-actions' );

        if ( p.relatedEvidence?.length ) {
            qaEl.appendChild( this._makeQuickAction( `🔍 View Evidence (${ p.relatedEvidence.length })`, () => {
                EventBus.emit( 'application:requested', { appId: 'evidence' } );
                setTimeout( () => EventBus.emit( 'evidence:focus-request', { evidenceId: p.relatedEvidence[ 0 ] } ), 300 );
            } ) );
        }

        if ( p.relatedConversations?.length ) {
            qaEl.appendChild( this._makeQuickAction( `💬 Open Conversation`, () => {
                EventBus.emit( 'application:requested', { appId: 'messenger' } );
                setTimeout( () => EventBus.emit( 'messenger:focus-request', { convId: p.relatedConversations[ 0 ] } ), 300 );
            } ) );
        }

        if ( p.relatedLocations?.length ) {
            qaEl.appendChild( this._makeQuickAction( `📍 View on Map`, () => {
                EventBus.emit( 'application:requested', { appId: 'city-map' } );
                setTimeout( () => EventBus.emit( 'map:focus-request', { locationId: p.relatedLocations[ 0 ] } ), 300 );
            } ) );
        }

        if ( !p.relatedEvidence?.length && !p.relatedConversations?.length && !p.relatedLocations?.length ) {
            qaEl.innerHTML = '<span class="pdb__empty-field">No quick actions available</span>';
        }

        // Notes textarea.
        const notesEl = this._detailEl.querySelector( '.pdb__notes' );
        notesEl.value = PeopleManager.getNotes( p.id );
        notesEl.addEventListener( 'input', () => {
            clearTimeout( this._notesTimer );
            this._notesTimer = setTimeout( () => {
                PeopleManager.saveNotes( p.id, notesEl.value );
            }, NOTES_DELAY );
        } );

        // Back button — phone.
        this._detailEl.querySelector( '.pdb__detail-back' )
            .addEventListener( 'click', () => {
                this._detailEl.classList.remove( 'pdb__detail--phone-active' );
            } );

    }

    _renderEmptyDetail() {

        if ( !this._detailEl ) return;

        this._detailEl.innerHTML = `
            <div class="pdb__detail-empty">
                <div class="pdb__detail-empty-emoji">🗃️</div>
                <div class="pdb__detail-empty-text">Select a person to view their profile</div>
            </div>
        `;

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    _field( label, value ) {
        return `
            <div class="pdb__detail-field">
                <span class="pdb__detail-field-label">${ label }</span>
                <span class="pdb__detail-field-value">${ this._escape( value ) }</span>
            </div>
        `;
    }

    _makeQuickAction( label, onClick ) {
        const btn = document.createElement( 'button' );
        btn.className   = 'pdb__qa-btn';
        btn.textContent = label;
        btn.setAttribute( 'type', 'button' );
        btn.addEventListener( 'click', onClick );
        return btn;
    }

    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default CriminalDatabase;
