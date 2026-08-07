/**
 * Messenger
 *
 * Purpose:
 *   In-game communication hub. Detectives read NPC messages, follow
 *   branching dialogue trees, follow links to Evidence Database and
 *   City Map, and write investigation notes per contact.
 *
 * Layout:
 *   Desktop  — three panels: conversation list | chat | contact info
 *   Tablet   — collapsible contact list
 *   Phone    — stacked: list → chat → contact info
 *
 * Data:
 *   Global conversations always visible (data/global/messenger/).
 *   Case conversations loaded per case (data/cases/{id}/messenger/).
 *   Player state (read/pinned/notes/choices) persists via StorageManager.
 *
 * Events consumed:
 *   investigationChanged   — load case conversations (Epic 01.1)
 *   messenger:loaded       — re-render conversation list
 *   messenger:*            — keep UI in sync with manager state
 *
 * Events emitted:
 *   messenger:conversation-opened
 *   messenger:message-read
 *   messenger:note-updated
 *   messenger:conversation-pinned
 */

import BaseApp          from '../../core/BaseApp.js';
import EventBus         from '../../core/EventBus.js';
import MessengerManager from '../../managers/MessengerManager.js';

const NOTES_DELAY = 800;

const ATTACHMENT_RENDER = {
    evidence: ( att ) => `🔍 ${ att.label ?? att.id }`,
    location: ( att ) => `📍 ${ att.label ?? att.locationId }`,
    image:    ( att ) => `📷 ${ att.label ?? 'Image' }`,
    document: ( att ) => `📄 ${ att.label ?? 'Document' }`,
    cctv:     ( att ) => `🎥 ${ att.label ?? 'CCTV Clip' }`,
};

class Messenger extends BaseApp {

    constructor( config ) {
        super( config );

        /** @type {string|null} */
        this._activeConvId   = null;
        /** @type {string|null} */
        this._activeCaseId   = null;
        /** @type {string}      */
        this._searchQuery    = '';

        // DOM refs.
        this._convListEl     = null;
        this._chatEl         = null;
        this._contactInfoEl  = null;
        this._searchInputEl  = null;
        this._notesEl        = null;
        this._choiceAreaEl   = null;

        // Notes autosave timer.
        this._notesTimer = null;

        // Bound EventBus handlers.
        this._onInvestigationChanged = ( { investigation } ) => this._syncInvestigation( investigation );
        this._onLoaded       = ()               => this._renderConvList();
        this._onContentUnlocked = ()             => this._renderConvList();
        this._onPinned       = ()               => this._renderConvList();
        this._onFocusRequest = ( { convId } )   => this._openConversation( convId );

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {
        contentEl.classList.add( 'msng' );
        this._buildLayout( contentEl );
    }

    open() {
        EventBus.on( 'investigationChanged',            this._onInvestigationChanged );
        EventBus.on( 'messenger:loaded',               this._onLoaded       );
        EventBus.on( 'content:unlocked',                this._onContentUnlocked );
        EventBus.on( 'content:hidden',                   this._onContentUnlocked );
        EventBus.on( 'messenger:conversation-pinned',  this._onPinned       );
        EventBus.on( 'messenger:focus-request',        this._onFocusRequest );
        this._syncInvestigation( this.context.getActiveInvestigation() );
    }

    close() {
        EventBus.off( 'investigationChanged',           this._onInvestigationChanged );
        EventBus.off( 'messenger:loaded',              this._onLoaded       );
        EventBus.off( 'content:unlocked',               this._onContentUnlocked );
        EventBus.off( 'content:hidden',                  this._onContentUnlocked );
        EventBus.off( 'messenger:conversation-pinned', this._onPinned       );
        EventBus.off( 'messenger:focus-request',       this._onFocusRequest );
        clearTimeout( this._notesTimer );
    }

    minimize() {}
    restore()  { this._renderConvList(); }

    destroy() {
        clearTimeout( this._notesTimer );
        this._convListEl    = null;
        this._chatEl        = null;
        this._contactInfoEl = null;
        this._searchInputEl = null;
        this._notesEl       = null;
        this._choiceAreaEl  = null;
        super.destroy();
    }

    // ─────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────

    _buildLayout( contentEl ) {

        // ── Left — conversation list ──────────────────────────────
        const left = document.createElement( 'div' );
        left.className = 'msng__left';

        const searchWrap = document.createElement( 'div' );
        searchWrap.className = 'msng__search-wrap';

        this._searchInputEl = document.createElement( 'input' );
        this._searchInputEl.type        = 'text';
        this._searchInputEl.className   = 'msng__search-input';
        this._searchInputEl.placeholder = 'Search...';
        this._searchInputEl.setAttribute( 'aria-label', 'Search conversations' );
        this._searchInputEl.addEventListener( 'input', () => {
            this._searchQuery = this._searchInputEl.value;
            this._renderConvList();
        } );
        searchWrap.appendChild( this._searchInputEl );

        this._convListEl = document.createElement( 'div' );
        this._convListEl.className = 'msng__conv-list';
        this._convListEl.setAttribute( 'role', 'list' );

        left.appendChild( searchWrap );
        left.appendChild( this._convListEl );

        // ── Center — chat ─────────────────────────────────────────
        const center = document.createElement( 'div' );
        center.className = 'msng__center';

        this._chatEl = document.createElement( 'div' );
        this._chatEl.className = 'msng__chat';
        this._chatEl.setAttribute( 'aria-live', 'polite' );
        this._renderEmptyChat();

        this._choiceAreaEl = document.createElement( 'div' );
        this._choiceAreaEl.className = 'msng__choice-area';

        center.appendChild( this._chatEl );
        center.appendChild( this._choiceAreaEl );

        // ── Right — contact info + notes ──────────────────────────
        this._contactInfoEl = document.createElement( 'div' );
        this._contactInfoEl.className = 'msng__contact-info';
        this._renderEmptyContact();

        contentEl.appendChild( left );
        contentEl.appendChild( center );
        contentEl.appendChild( this._contactInfoEl );

    }

    // ─────────────────────────────────────────────────────────────
    // Conversation List
    // ─────────────────────────────────────────────────────────────

    _syncInvestigation( investigation ) {

        if ( !investigation ) {
            this._activeCaseId = null;
            this._renderEmptyChat();
            this._renderEmptyContact();
            this._renderConvList();
            return;
        }

        if ( this._activeCaseId === investigation.caseId ) {
            this._renderConvList();
            return;
        }

        this._activeCaseId = investigation.caseId;
        this._activeConvId = null;
        this._renderEmptyChat();
        this._renderEmptyContact();
        MessengerManager.loadForCase( investigation.caseId );
    }

    _renderConvList() {

        if ( !this._convListEl ) return;

        if ( !this._activeCaseId ) {
            this._convListEl.innerHTML = `<div class="msng__empty-hint">No active investigation.<br>Open Case Management and start an investigation.</div>`;
            return;
        }

        let conversations = this._searchQuery.trim()
            ? MessengerManager.search( this._searchQuery )
            : MessengerManager.getAll();

        // Mission 19 — visibility is UnlockManager's call, not ours.
        const visibleIds = new Set( this.context.getVisibleIds( 'conversation', conversations.map( c => c.id ) ) );
        conversations = conversations.filter( c => visibleIds.has( c.id ) );

        this._convListEl.innerHTML = '';

        if ( conversations.length === 0 ) {
            this._convListEl.innerHTML = `<div class="msng__empty-hint">No conversations found.</div>`;
            return;
        }

        conversations.forEach( conv => {
            this._convListEl.appendChild( this._buildConvItem( conv ) );
        } );

    }

    _buildConvItem( conv ) {

        const item = document.createElement( 'div' );
        item.className = 'msng__conv-item';
        item.dataset.convId = conv.id;
        item.setAttribute( 'role', 'listitem' );
        item.setAttribute( 'tabindex', '0' );

        if ( conv.id === this._activeConvId ) item.classList.add( 'msng__conv-item--active' );

        const visibleMsgs = MessengerManager.getVisibleMessages( conv );
        const lastMsg     = visibleMsgs.filter( m => m.type !== 'system' && m.type !== 'choice' ).pop();
        const preview     = lastMsg?.text ?? '—';
        const timestamp   = lastMsg ? this._formatTime( lastMsg.timestamp ) : '';
        const unread      = conv.unread ?? 0;

        item.innerHTML = `
            <div class="msng__conv-avatar">${ conv.avatarEmoji ?? '👤' }</div>
            <div class="msng__conv-body">
                <div class="msng__conv-header">
                    <span class="msng__conv-name">${ this._escape( conv.name ) }${ conv.pinned ? ' 📌' : '' }</span>
                    <span class="msng__conv-time">${ timestamp }</span>
                </div>
                <div class="msng__conv-preview">
                    <span class="msng__conv-role">${ this._escape( conv.role ?? '' ) }</span>
                    <span class="msng__conv-last">${ this._escape( preview.slice( 0, 40 ) + ( preview.length > 40 ? '…' : '' ) ) }</span>
                </div>
            </div>
            ${ unread > 0 ? `<span class="msng__conv-unread">${ unread }</span>` : '' }
            ${ ( conv.online === true ) ? '<span class="msng__conv-online" title="Online"></span>' : '' }
        `;

        item.addEventListener( 'click', () => this._openConversation( conv.id ) );
        item.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Enter' || e.key === ' ' ) {
                e.preventDefault();
                this._openConversation( conv.id );
            }
        } );

        return item;

    }

    // ─────────────────────────────────────────────────────────────
    // Chat
    // ─────────────────────────────────────────────────────────────

    _openConversation( convId ) {

        const conv = MessengerManager.getById( convId );
        if ( !conv ) return;

        this._activeConvId = convId;

        // Update list selection.
        this._convListEl.querySelectorAll( '.msng__conv-item' ).forEach( el => {
            el.classList.toggle( 'msng__conv-item--active', el.dataset.convId === convId );
        } );

        MessengerManager.markRead( convId );
        this._renderChat( conv );
        this._renderContactInfo( conv );

        EventBus.emit( 'messenger:conversation-opened', { convId } );

    }

    _renderChat( conv ) {

        if ( !this._chatEl ) return;

        this._chatEl.innerHTML = '';

        const messages = MessengerManager.getVisibleMessages( conv );
        const pendingChoice = this._findPendingChoice( conv, messages );

        messages.forEach( msg => {
            if ( msg.type === 'choice' ) return; // Choices rendered separately.
            this._chatEl.appendChild( this._buildBubble( msg, conv ) );
        } );

        // Auto-scroll to bottom.
        this._chatEl.scrollTop = this._chatEl.scrollHeight;

        // Render choices.
        this._renderChoices( conv, pendingChoice );

    }

    _buildBubble( msg, conv ) {

        const wrap = document.createElement( 'div' );
        wrap.className = `msng__bubble-wrap msng__bubble-wrap--${ msg.type }`;

        if ( msg.type === 'system' ) {
            const sys = document.createElement( 'div' );
            sys.className   = 'msng__system-msg';
            sys.textContent = msg.text;
            wrap.appendChild( sys );
            return wrap;
        }

        const isPlayer = msg.type === 'player';

        const bubble = document.createElement( 'div' );
        bubble.className = `msng__bubble ${ isPlayer ? 'msng__bubble--player' : 'msng__bubble--npc' }`;

        if ( !isPlayer ) {
            const senderEl = document.createElement( 'div' );
            senderEl.className   = 'msng__bubble-sender';
            senderEl.textContent = msg.sender;
            bubble.appendChild( senderEl );
        }

        const textEl = document.createElement( 'div' );
        textEl.className   = 'msng__bubble-text';
        textEl.textContent = msg.text;
        bubble.appendChild( textEl );

        // Attachments.
        if ( msg.attachments?.length ) {
            const attWrap = document.createElement( 'div' );
            attWrap.className = 'msng__bubble-attachments';

            msg.attachments.forEach( att => {
                const chip = document.createElement( 'button' );
                chip.className   = 'msng__att-chip';
                chip.setAttribute( 'type', 'button' );
                const renderer   = ATTACHMENT_RENDER[ att.type ];
                chip.textContent = renderer ? renderer( att ) : `📎 ${ att.label ?? att.type }`;
                chip.addEventListener( 'click', () => this._handleAttachmentClick( att ) );
                attWrap.appendChild( chip );
            } );

            bubble.appendChild( attWrap );
        }

        const timeEl = document.createElement( 'div' );
        timeEl.className   = 'msng__bubble-time';
        timeEl.textContent = this._formatTime( msg.timestamp );
        bubble.appendChild( timeEl );

        wrap.appendChild( bubble );

        return wrap;

    }

    // ─────────────────────────────────────────────────────────────
    // Choices (Branching Dialogue)
    // ─────────────────────────────────────────────────────────────

    /**
     * Find the next pending choice message that has not yet been answered.
     *
     * @param {Object}   conv
     * @param {Object[]} visibleMessages
     * @returns {Object|null}
     */
    _findPendingChoice( conv, visibleMessages ) {

        for ( const msg of conv.messages ) {
            if ( msg.type !== 'choice' ) continue;
            const choiceId = msg.choices?.[ 0 ]?.id;
            if ( !choiceId ) continue;
            const made = MessengerManager.getChoiceMade( conv.id, msg.choices[ 0 ].id );
            if ( !made ) return msg;
        }

        return null;

    }

    _renderChoices( conv, choiceMsg ) {

        if ( !this._choiceAreaEl ) return;

        this._choiceAreaEl.innerHTML = '';

        if ( !choiceMsg ) return;

        const label = document.createElement( 'div' );
        label.className   = 'msng__choice-label';
        label.textContent = choiceMsg.prompt ?? 'Choose a response:';
        this._choiceAreaEl.appendChild( label );

        choiceMsg.choices.forEach( choice => {
            const btn = document.createElement( 'button' );
            btn.className   = 'msng__choice-btn';
            btn.textContent = choice.text;
            btn.setAttribute( 'type', 'button' );

            btn.addEventListener( 'click', () => {
                const branch = MessengerManager.makeChoice( conv.id, choice.id, choice.nextMessageId );
                this._renderChat( conv );
            } );

            this._choiceAreaEl.appendChild( btn );
        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Attachment Handling
    // ─────────────────────────────────────────────────────────────

    _handleAttachmentClick( att ) {

        switch ( att.type ) {

            case 'evidence':
                EventBus.emit( 'application:requested', { appId: 'evidence' } );
                setTimeout( () => EventBus.emit( 'evidence:focus-request', { evidenceId: att.id } ), 300 );
                break;

            case 'location':
                EventBus.emit( 'application:requested', { appId: 'city-map' } );
                setTimeout( () => EventBus.emit( 'map:focus-request', { locationId: att.locationId } ), 300 );
                break;

            case 'cctv':
                EventBus.emit( 'application:requested', { appId: 'cctv' } );
                setTimeout( () => EventBus.emit( 'cctv:focus-request', { cameraId: att.cameraId, timestamp: att.timestamp ?? 0 } ), 300 );
                break;

            default:
                console.info( `Messenger: Attachment type "${ att.type }" — no handler yet.` );

        }

    }

    // ─────────────────────────────────────────────────────────────
    // Contact Info Panel
    // ─────────────────────────────────────────────────────────────

    _renderContactInfo( conv ) {

        if ( !this._contactInfoEl ) return;

        this._contactInfoEl.innerHTML = `
            <div class="msng__contact-avatar">${ conv.avatarEmoji ?? '👤' }</div>
            <div class="msng__contact-name">${ this._escape( conv.name ) }</div>
            <div class="msng__contact-role">${ this._escape( conv.role ?? '' ) }</div>
            <div class="msng__contact-status ${ conv.online ? 'msng__contact-status--online' : '' }">
                ${ conv.online ? '● Online' : '○ Offline' }
            </div>

            <div class="msng__contact-actions">
                <button type="button" class="msng__contact-action-btn" data-action="pin">
                    ${ conv.pinned ? '📌 Unpin' : '📌 Pin' }
                </button>
            </div>

            <div class="msng__contact-section">Investigation Notes</div>
            <textarea class="msng__notes" placeholder="Notes about this contact..."></textarea>
        `;

        // Pin button.
        this._contactInfoEl.querySelector( '[data-action="pin"]' )
            .addEventListener( 'click', () => {
                MessengerManager.togglePin( conv.id );
                this._renderContactInfo( MessengerManager.getById( conv.id ) );
            } );

        // Notes.
        const notesEl = this._contactInfoEl.querySelector( '.msng__notes' );
        this._notesEl  = notesEl;
        notesEl.value  = MessengerManager.getNotes( conv.id );
        notesEl.addEventListener( 'input', () => {
            clearTimeout( this._notesTimer );
            this._notesTimer = setTimeout( () => {
                MessengerManager.saveNotes( conv.id, notesEl.value );
            }, NOTES_DELAY );
        } );

    }

    _renderEmptyChat() {

        if ( !this._chatEl ) return;
        this._chatEl.innerHTML = `
            <div class="msng__empty-chat">
                <div class="msng__empty-chat-emoji">💬</div>
                <div class="msng__empty-chat-text">Select a conversation</div>
            </div>
        `;
        if ( this._choiceAreaEl ) this._choiceAreaEl.innerHTML = '';

    }

    _renderEmptyContact() {

        if ( !this._contactInfoEl ) return;
        this._contactInfoEl.innerHTML = `
            <div class="msng__contact-empty">
                <div class="msng__contact-empty-emoji">👤</div>
                <div class="msng__contact-empty-text">No contact selected</div>
            </div>
        `;

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    _formatTime( iso ) {

        if ( !iso ) return '';
        const d = new Date( iso );
        if ( isNaN( d.getTime() ) ) return iso;
        const h = String( d.getHours() ).padStart( 2, '0' );
        const m = String( d.getMinutes() ).padStart( 2, '0' );
        return `${ h }:${ m }`;

    }

    _escape( str ) {
        const div = document.createElement( 'div' );
        div.textContent = str ?? '';
        return div.innerHTML;
    }

}

export default Messenger;
