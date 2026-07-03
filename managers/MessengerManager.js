/**
 * MessengerManager
 *
 * Purpose:
 *   Loads conversation data per case (plus global conversations) from
 *   JSON files, merges persisted player state (read, pinned, notes,
 *   dialogue position), and provides a clean API for the Messenger app.
 *
 * Responsibilities:
 *   - Load case conversations from /data/cases/{caseId}/messenger/
 *   - Load global conversations from /data/global/messenger/
 *   - Merge and expose a unified conversation list
 *   - Track dialogue branch state per conversation
 *   - Persist read/pinned/notes/lastMessage via StorageManager
 *   - Emit EventBus events on all state changes
 *
 * Storage key: 'messenger-state'
 * Format: {
 *   [convId]: {
 *     read:        boolean,
 *     pinned:      boolean,
 *     notes:       string,
 *     lastMessage: string|null,
 *     choicesMade: { [choiceId]: string }   — choice id → chosen nextMessageId
 *   }
 * }
 *
 * Dialogue branching:
 *   Messages of type "choice" present options to the player. When a choice
 *   is selected, its nextMessageId is resolved from the conversation's
 *   "branches" map and appended to the visible message thread.
 *   Choices are persisted so conversations replay correctly on reopen.
 *
 * Events emitted:
 *   messenger:loaded                — conversations ready    { count }
 *   messenger:conversation-opened   — conv selected          { convId }
 *   messenger:message-read          — messages marked read   { convId }
 *   messenger:note-updated          — note saved             { convId, notes }
 *   messenger:conversation-pinned   — pin toggled            { convId, pinned }
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Conversation JSON files are read-only; mutable state lives in StorageManager.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY  = 'messenger-state';
const CASE_BASE    = './data/cases/';
const GLOBAL_BASE  = './data/global/';

class MessengerManagerClass {

    constructor() {

        /**
         * All loaded conversations, keyed by id.
         * Contains both global and case-specific.
         * @type {Map<string, Object>}
         */
        this._conversations = new Map();

        /**
         * Persisted player state, keyed by conversation id.
         * @type {Object}
         */
        this._state = {};

        /** @type {string|null} */
        this._activeCaseId = null;

        /** @type {boolean} */
        this._stateLoaded = false;

        /** @type {boolean} */
        this._globalLoaded = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Load global conversations and persisted state.
     * Safe to call multiple times — only executes once.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        if ( this._stateLoaded ) return;

        this._state = StorageManager.load( STORAGE_KEY, {} );
        this._stateLoaded = true;

        await this._loadGlobal();

        console.info( 'MessengerManager: Initialized.' );

    }

    /**
     * Load case-specific conversations.
     * Merges with existing global conversations.
     *
     * @param {string} caseId
     * @returns {Promise<void>}
     */
    async loadForCase( caseId ) {

        // Remove any previously loaded case conversations.
        for ( const [ id, conv ] of this._conversations ) {
            if ( conv.caseId !== null ) {
                this._conversations.delete( id );
            }
        }

        this._activeCaseId = caseId;

        if ( !caseId ) {
            EventBus.emit( 'messenger:loaded', { count: this._conversations.size } );
            return;
        }

        const indexUrl = `${ CASE_BASE }${ caseId }/messenger/index.json`;

        try {
            const res = await fetch( indexUrl );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            const loads = ( index.files ?? [] ).map( f => this._loadFile( `${ CASE_BASE }${ caseId }/messenger/${ f }` ) );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.warn( `MessengerManager: No conversations found for "${ caseId }".` );
        }

        EventBus.emit( 'messenger:loaded', { count: this._conversations.size } );
        console.info( `MessengerManager: ${ this._conversations.size } total conversation(s) loaded.` );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all conversations, pinned first, then sorted by last message time.
     *
     * @returns {Object[]}
     */
    getAll() {

        return Array.from( this._conversations.values() )
            .sort( ( a, b ) => {
                if ( a.pinned !== b.pinned ) return a.pinned ? -1 : 1;
                return this._lastTimestamp( b ) - this._lastTimestamp( a );
            } );

    }

    /**
     * Return a single conversation by id.
     *
     * @param {string} convId
     * @returns {Object|undefined}
     */
    getById( convId ) {
        return this._conversations.get( convId );
    }

    /**
     * Search conversations by contact name, role, or message text.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    search( query ) {

        if ( !query.trim() ) return this.getAll();

        const q = query.toLowerCase();

        return this.getAll().filter( conv =>
            conv.name.toLowerCase().includes( q ) ||
            ( conv.role ?? '' ).toLowerCase().includes( q ) ||
            this._getVisibleMessages( conv ).some( m =>
                ( m.text ?? '' ).toLowerCase().includes( q )
            )
        );

    }

    /**
     * Return the visible message thread for a conversation,
     * including resolved branches from player choices.
     *
     * @param {Object} conv
     * @returns {Object[]}
     */
    getVisibleMessages( conv ) {
        return this._getVisibleMessages( conv );
    }

    /**
     * Return the total unread count across all conversations.
     *
     * @returns {number}
     */
    getTotalUnread() {
        return Array.from( this._conversations.values() )
            .reduce( ( sum, c ) => sum + ( c.unread ?? 0 ), 0 );
    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Mark all messages in a conversation as read.
     *
     * @param {string} convId
     * @returns {void}
     */
    markRead( convId ) {

        const conv = this._conversations.get( convId );
        if ( !conv ) return;

        conv.unread = 0;
        this._ensureState( convId );
        this._state[ convId ].read = true;
        this._persist();

        EventBus.emit( 'messenger:message-read', { convId } );

    }

    /**
     * Toggle the pinned state of a conversation.
     *
     * @param {string} convId
     * @returns {void}
     */
    togglePin( convId ) {

        const conv = this._conversations.get( convId );
        if ( !conv ) return;

        conv.pinned = !conv.pinned;
        this._ensureState( convId );
        this._state[ convId ].pinned = conv.pinned;
        this._persist();

        EventBus.emit( 'messenger:conversation-pinned', { convId, pinned: conv.pinned } );

    }

    /**
     * Save detective notes for a conversation.
     *
     * @param {string} convId
     * @param {string} notes
     * @returns {void}
     */
    saveNotes( convId, notes ) {

        this._ensureState( convId );
        this._state[ convId ].notes = notes;
        this._persist();

        EventBus.emit( 'messenger:note-updated', { convId, notes } );

    }

    /**
     * Get detective notes for a conversation.
     *
     * @param {string} convId
     * @returns {string}
     */
    getNotes( convId ) {
        return this._state[ convId ]?.notes ?? '';
    }

    /**
     * Record the player's choice in a branching dialogue.
     * Resolves the next message from the conversation's branches map.
     *
     * @param {string} convId
     * @param {string} choiceId      - The id of the chosen option.
     * @param {string} nextMessageId - The branch message id to resolve.
     * @returns {Object|null}        - The resolved branch message, or null.
     */
    makeChoice( convId, choiceId, nextMessageId ) {

        const conv = this._conversations.get( convId );
        if ( !conv ) return null;

        // Persist the choice so the conversation replays correctly.
        this._ensureState( convId );
        if ( !this._state[ convId ].choicesMade ) {
            this._state[ convId ].choicesMade = {};
        }
        this._state[ convId ].choicesMade[ choiceId ] = nextMessageId;
        this._persist();

        return conv.branches?.[ nextMessageId ] ?? null;

    }

    /**
     * Return the choice previously made for a given choice message, if any.
     *
     * @param {string} convId
     * @param {string} choiceId
     * @returns {string|null}  - The nextMessageId, or null if not yet chosen.
     */
    getChoiceMade( convId, choiceId ) {
        return this._state[ convId ]?.choicesMade?.[ choiceId ] ?? null;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal — loading
    // ─────────────────────────────────────────────────────────────

    async _loadGlobal() {

        if ( this._globalLoaded ) return;

        const indexUrl = `${ GLOBAL_BASE }messenger/index.json`;

        try {
            const res = await fetch( indexUrl );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const index = await res.json();
            const loads = ( index.files ?? [] ).map( f =>
                this._loadFile( `${ GLOBAL_BASE }messenger/${ f }` )
            );
            await Promise.all( loads );
            this._globalLoaded = true;
        }
        catch ( error ) {
            console.warn( 'MessengerManager: No global conversations found.' );
        }

    }

    async _loadFile( url ) {

        try {
            const res = await fetch( url );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();

            // Merge persisted state.
            const saved = this._state[ data.id ] ?? {};
            data.pinned = saved.pinned ?? false;
            data.unread = data.unread ?? 0;

            this._conversations.set( data.id, data );
        }
        catch ( error ) {
            console.error( `MessengerManager: Failed to load "${ url }".`, error );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — dialogue resolution
    // ─────────────────────────────────────────────────────────────

    /**
     * Walk the conversation's message list, resolving branch choices,
     * and return the full visible thread.
     *
     * @param {Object} conv
     * @returns {Object[]}
     */
    _getVisibleMessages( conv ) {

        const visible  = [];
        const branches = conv.branches ?? {};
        const choices  = this._state[ conv.id ]?.choicesMade ?? {};

        const processMessage = ( msg ) => {

            if ( !msg ) return;
            visible.push( msg );

            if ( msg.type === 'choice' ) {
                // If a choice was made, append the chosen branch.
                const choiceEntry = msg.choices?.find( c => choices[ c.id ] );
                if ( choiceEntry ) {
                    const nextId = choices[ choiceEntry.id ];
                    // Append the player's choice as a player message.
                    visible.push( {
                        id:        `player-${ choiceEntry.id }`,
                        type:      'player',
                        sender:    'You',
                        timestamp: msg.timestamp,
                        text:      choiceEntry.text,
                        attachments: [],
                    } );
                    const branch = branches[ nextId ];
                    if ( branch ) processMessage( branch );
                }
                return;
            }

            // Follow the chain if msg has a nextMessageId.
            if ( msg.nextMessageId && branches[ msg.nextMessageId ] ) {
                processMessage( branches[ msg.nextMessageId ] );
            }

        };

        conv.messages.forEach( processMessage );

        return visible;

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — utilities
    // ─────────────────────────────────────────────────────────────

    _lastTimestamp( conv ) {

        const msgs = conv.messages;
        if ( !msgs?.length ) return 0;
        return new Date( msgs[ msgs.length - 1 ].timestamp ).getTime();

    }

    _ensureState( convId ) {

        if ( !this._state[ convId ] ) {
            this._state[ convId ] = { read: false, pinned: false, notes: '', lastMessage: null, choicesMade: {} };
        }

    }

    _persist() {
        StorageManager.save( STORAGE_KEY, this._state );
    }

}

const MessengerManager = new MessengerManagerClass();

export default MessengerManager;
