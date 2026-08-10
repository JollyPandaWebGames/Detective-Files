/**
 * MailManager
 *
 * Purpose:
 *   Loads email data from /data/mail/, merges persisted state
 *   (read/starred/archived) from StorageManager, and provides
 *   a clean API for the Police Mail application.
 *
 * Responsibilities:
 *   - Discover and fetch all mail JSON files via data/mail/index.json
 *   - Merge saved read/starred/archived state over loaded data
 *   - Provide filtered views: inbox, starred, archived, by-case
 *   - Persist state changes immediately via StorageManager
 *   - Emit EventBus events on all state changes
 *   - Handle case:started events to surface related mail
 *
 * Storage key: 'mail-state'
 * Format: { [mailId]: { read, starred, archived } }
 *
 * Events emitted:
 *   mail:loaded    — initial load complete   { count }
 *   mail:selected  — user selected a mail    { mail }
 *   mail:read      — mail marked read        { mailId }
 *   mail:unread    — mail marked unread      { mailId }
 *   mail:starred   — mail starred            { mailId }
 *   mail:unstarred — mail unstarred          { mailId }
 *   mail:archived  — mail archived           { mailId }
 *
 * Events consumed:
 *   case:started   — surfaces related unread mail
 *
 * Rules:
 *   Never access localStorage directly — use StorageManager.
 *   Mail JSON files are read-only; state lives in StorageManager only.
 */

import StorageManager from './StorageManager.js';
import EventBus       from '../core/EventBus.js';

const STORAGE_KEY  = 'mail-state';
const MAIL_INDEX   = './data/mail/index.json';
const MAIL_BASE    = './data/mail/';

class MailManagerClass {

    constructor() {

        /**
         * All loaded mail objects (data + merged state).
         * @type {Map<string, Object>}
         */
        this._mails = new Map();

        /**
         * Persisted per-mail state, keyed by mail id.
         * @type {Object}
         */
        this._state = {};

        /**
         * Whether mail has been loaded.
         * @type {boolean}
         */
        this._loaded = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Discover and load all mail from data/mail/index.json.
     * Merges persisted state over loaded data.
     * Safe to call multiple times — returns immediately if already loaded.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        if ( this._loaded ) return;

        this._state = StorageManager.load( STORAGE_KEY, {} );

        try {
            const indexRes = await fetch( MAIL_INDEX );
            if ( !indexRes.ok ) throw new Error( `HTTP ${ indexRes.status }` );
            const index = await indexRes.json();

            const loads = ( index.files ?? [] ).map( file => this._loadFile( file ) );
            await Promise.all( loads );
        }
        catch ( error ) {
            console.error( 'MailManager: Failed to load mail index.', error );
        }

        this._loaded = true;
        EventBus.emit( 'mail:loaded', { count: this._mails.size } );
        console.info( `MailManager: Loaded ${ this._mails.size } mail(s).` );

        // Listen for case starts to surface related mail.
        EventBus.on( 'case:started', ( { caseId } ) => this._onCaseStarted( caseId ) );

    }

    /**
     * Inject a runtime-generated mail (Mission 17 — Headquarters
     * responses to a submitted resolution). Unlike every other mail,
     * this doesn't come from a JSON file — it's composed by
     * ResolutionManager after a case is submitted. Goes through the
     * same merge path as file-loaded mail so it behaves identically
     * (read/starred/archived state, case scoping) once it exists.
     *
     * @param {Object} mailData - Same shape as a mail JSON file.
     * @returns {void}
     */
    injectMail( mailData ) {

        this._mergeMail( mailData );
        EventBus.emit( 'mail:new',    { mail: this._mails.get( mailData.id ) } );
        EventBus.emit( 'mail:loaded', { count: this._mails.size } );

    }

    /**
     * Case 00 replay support — restore every static mail belonging to
     * this case back to its unread/unstarred/inbox default, and remove
     * every runtime-generated mail (state-machine nudges, resolution
     * feedback — see HqMailBuilder, `mail-state-{caseId}-{timestamp}`
     * ids) so a fresh playthrough regenerates them instead of carrying
     * over stale ones. Unlike every other manager, mail is loaded once
     * globally at boot rather than per-case, so this mutates the
     * in-memory objects directly instead of relying on a future
     * loadForCase() to re-fetch them. Call before loadForCase().
     *
     * @param {string} caseId
     * @returns {void}
     */
    resetForCase( caseId ) {

        for ( const mail of [ ...this._mails.values() ] ) {

            if ( mail.caseId !== caseId ) continue;

            const isGenerated = mail.id.startsWith( 'mail-state-' );

            delete this._state[ mail.id ];

            if ( isGenerated ) {
                this._mails.delete( mail.id );
            }
            else {
                mail.read     = false;
                mail.starred  = false;
                mail.archived = false;
                mail.folder   = 'inbox';
            }

        }

        StorageManager.save( STORAGE_KEY, this._state );
        EventBus.emit( 'mail:loaded', { count: this._mails.size } );

    }

    // ─────────────────────────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────────────────────────

    /**
     * Return all mail in a given folder, sorted newest-first.
     *
     * @param {string} folder - 'inbox' | 'starred' | 'archived' | 'sent'
     * @param {string} [caseId] - When provided (Epic 01.1), only mail
     *   belonging to that case plus department-wide mail (caseId: null
     *   in the JSON) is returned. Omit to get every mail regardless of
     *   case — kept as the default for any future non-investigation
     *   caller, though Police Mail itself always passes one now.
     * @returns {Object[]}
     */
    getFolder( folder, caseId ) {

        const all = Array.from( this._mails.values() )
            .filter( m => caseId === undefined || m.caseId === caseId || m.caseId == null );

        let filtered;

        if ( folder === 'starred' ) {
            filtered = all.filter( m => m.starred && !m.archived );
        }
        else if ( folder === 'archived' ) {
            filtered = all.filter( m => m.archived );
        }
        else if ( folder === 'sent' ) {
            filtered = all.filter( m => m.folder === 'sent' );
        }
        else {
            // inbox — not archived, not sent
            filtered = all.filter( m => !m.archived && m.folder !== 'sent' );
        }

        return filtered.sort( ( a, b ) => b.date.localeCompare( a.date ) );

    }

    /**
     * Return all mail for a given case id.
     *
     * @param {string} caseId
     * @returns {Object[]}
     */
    getByCase( caseId ) {

        return Array.from( this._mails.values() )
            .filter( m => m.caseId === caseId )
            .sort( ( a, b ) => b.date.localeCompare( a.date ) );

    }

    /**
     * Return a single mail by id.
     *
     * @param {string} mailId
     * @returns {Object|undefined}
     */
    getById( mailId ) {
        return this._mails.get( mailId );
    }

    /**
     * Return the count of unread mails in the inbox.
     *
     * @returns {number}
     */
    getUnreadCount() {
        return Array.from( this._mails.values() )
            .filter( m => !m.read && !m.archived && m.folder !== 'sent' )
            .length;
    }

    /**
     * Search mail by sender, subject, or body.
     *
     * @param {string} query
     * @returns {Object[]}
     */
    /**
     * @param {string} query
     * @param {string} [caseId] - Epic 01.1 — scope results to the active
     *   investigation plus department-wide mail, same as getFolder().
     * @returns {Object[]}
     */
    search( query, caseId ) {

        if ( !query.trim() ) return this.getFolder( 'inbox', caseId );

        const q = query.toLowerCase();

        return Array.from( this._mails.values() )
            .filter( m => caseId === undefined || m.caseId === caseId || m.caseId == null )
            .filter( m =>
                m.from.toLowerCase().includes( q ) ||
                m.subject.toLowerCase().includes( q ) ||
                m.body.toLowerCase().includes( q )
            )
            .sort( ( a, b ) => b.date.localeCompare( a.date ) );

    }

    /**
     * Return all attachments across all loaded mail, each tagged with
     * its parent mail id and case id.
     *
     * Mission 07 hook point: Evidence Database will call this to surface
     * mail attachments as collectible evidence items.
     *
     * @returns {{ mailId: string, caseId: string|null, attachment: Object }[]}
     */
    getAllAttachments() {

        const result = [];

        for ( const mail of this._mails.values() ) {
            for ( const attachment of mail.attachments ?? [] ) {
                result.push( { mailId: mail.id, caseId: mail.caseId, attachment } );
            }
        }

        return result;

    }

    /**
     * Return a single attachment by id, with its parent mail context.
     *
     * @param {string} attachmentId
     * @returns {{ mailId: string, caseId: string|null, attachment: Object }|null}
     */
    getAttachmentById( attachmentId ) {

        return this.getAllAttachments().find( a => a.attachment.id === attachmentId ) ?? null;

    }

    /**
     * Dynamically inject a mail item created at runtime (e.g. from ForensicsManager).
     * The item is added to the in-memory map and emits 'mail:loaded' so
     * Police Mail refreshes its list automatically if open.
     *
     * @param {Object} mail - A complete mail object following the schema.
     * @returns {void}
     */
    injectMail( mail ) {

        if ( !mail || !mail.id ) {
            console.warn( 'MailManager.injectMail: mail must have an id.' );
            return;
        }

        // Merge with any persisted state for this id (edge case: re-injection).
        this._mergeMail( mail );

        EventBus.emit( 'mail:loaded', {} );

        console.info( `MailManager: Injected mail "${ mail.id }".` );

    }

    // ─────────────────────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────────────────────

    /**
     * Mark a mail as read.
     *
     * @param {string} mailId
     * @returns {void}
     */
    markRead( mailId ) {

        const mail = this._mails.get( mailId );
        if ( !mail || mail.read ) return;

        mail.read = true;
        this._saveState( mailId );
        EventBus.emit( 'mail:read', { mailId } );

    }

    /**
     * Mark a mail as unread.
     *
     * @param {string} mailId
     * @returns {void}
     */
    markUnread( mailId ) {

        const mail = this._mails.get( mailId );
        if ( !mail || !mail.read ) return;

        mail.read = false;
        this._saveState( mailId );
        EventBus.emit( 'mail:unread', { mailId } );

    }

    /**
     * Toggle starred status.
     *
     * @param {string} mailId
     * @returns {void}
     */
    toggleStar( mailId ) {

        const mail = this._mails.get( mailId );
        if ( !mail ) return;

        mail.starred = !mail.starred;
        this._saveState( mailId );
        EventBus.emit( mail.starred ? 'mail:starred' : 'mail:unstarred', { mailId } );

    }

    /**
     * Archive a mail.
     *
     * @param {string} mailId
     * @returns {void}
     */
    archive( mailId ) {

        const mail = this._mails.get( mailId );
        if ( !mail || mail.archived ) return;

        mail.archived = true;
        this._saveState( mailId );
        EventBus.emit( 'mail:archived', { mailId } );

    }

    /**
     * Unarchive a mail (return to inbox).
     *
     * @param {string} mailId
     * @returns {void}
     */
    unarchive( mailId ) {

        const mail = this._mails.get( mailId );
        if ( !mail || !mail.archived ) return;

        mail.archived = false;
        this._saveState( mailId );
        EventBus.emit( 'mail:unarchived', { mailId } );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — loading
    // ─────────────────────────────────────────────────────────────

    /**
     * Case 00 replay support. Mail is unusual among the gameplay
     * managers — it's loaded once, globally, at boot rather than
     * per-case, so there's no loadForCase() to naturally start fresh.
     * Two kinds of mail need different treatment:
     *
     *   - Static mail (from a data/mail/*.json file, id doesn't start
     *     with 'mail-state-') — reset its read/starred/archived state
     *     back to defaults, but keep the mail itself; it will never be
     *     re-fetched, so deleting it would lose it permanently.
     *   - Generated mail (built at runtime by HqMailBuilder /
     *     ResolutionManager, id starts with 'mail-state-') — remove it
     *     entirely. Replaying should regenerate these fresh from the
     *     state machine and resolution engine, not carry over stale
     *     ones from the previous playthrough.
     *
     * Call before StateMachineManager.loadForCase() and
     * ResolutionManager.loadForCase(), since both of those can generate
     * mail as soon as they load.
     *
     * @param {string} caseId
     * @returns {void}
     */
    resetForCase( caseId ) {

        for ( const [ id, mail ] of [ ...this._mails ] ) {

            if ( mail.caseId !== caseId ) continue;

            if ( id.startsWith( 'mail-state-' ) ) {
                this._mails.delete( id );
                delete this._state[ id ];
                continue;
            }

            mail.read     = false;
            mail.starred  = false;
            mail.archived = false;
            delete this._state[ id ];

        }

        StorageManager.save( STORAGE_KEY, this._state );
        EventBus.emit( 'mail:loaded', { count: this._mails.size } );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — loading
    // ─────────────────────────────────────────────────────────────

    /**
     * Fetch and register a single mail file.
     *
     * @param {string} filename
     * @returns {Promise<void>}
     */
    async _loadFile( filename ) {

        try {
            const res = await fetch( `${ MAIL_BASE }${ filename }` );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
            const data = await res.json();
            this._mergeMail( data );
        }
        catch ( error ) {
            console.error( `MailManager: Failed to load "${ filename }".`, error );
        }

    }

    /**
     * Merge a loaded mail object with persisted state and store it.
     *
     * @param {Object} data - Raw mail JSON.
     * @returns {void}
     */
    _mergeMail( data ) {

        const saved = this._state[ data.id ] ?? {};

        const mail = {
            ...data,
            // Override with persisted state.
            read:     saved.read     ?? data.read     ?? false,
            starred:  saved.starred  ?? data.starred  ?? false,
            archived: saved.archived ?? data.archived ?? false,
        };

        this._mails.set( mail.id, mail );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — persistence
    // ─────────────────────────────────────────────────────────────

    /**
     * Persist the state of a single mail to StorageManager.
     *
     * @param {string} mailId
     * @returns {void}
     */
    _saveState( mailId ) {

        const mail = this._mails.get( mailId );
        if ( !mail ) return;

        this._state[ mailId ] = {
            read:     mail.read,
            starred:  mail.starred,
            archived: mail.archived,
        };

        StorageManager.save( STORAGE_KEY, this._state );

    }

    // ─────────────────────────────────────────────────────────────
    // Internal — case integration
    // ─────────────────────────────────────────────────────────────

    /**
     * When a case starts, emit mail:case-mail-available if unread
     * mail exists for that case, so PoliceMail can surface it.
     *
     * @param {string} caseId
     * @returns {void}
     */
    _onCaseStarted( caseId ) {

        const related = this.getByCase( caseId ).filter( m => !m.read );

        if ( related.length > 0 ) {
            EventBus.emit( 'mail:case-mail-available', {
                caseId,
                mailIds: related.map( m => m.id ),
                firstMailId: related[ related.length - 1 ].id,
            } );
        }

    }

}

// Singleton.
const MailManager = new MailManagerClass();

export default MailManager;
