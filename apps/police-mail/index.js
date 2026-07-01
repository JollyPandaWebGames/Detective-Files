/**
 * PoliceMail
 *
 * Purpose:
 *   The detective's primary communication system. Receives case
 *   assignments, lab results, tips, and daily HQ briefings.
 *
 * Layout:
 *   Desktop/Tablet — three panels: folder sidebar | email list | email content
 *   Phone          — single column: folders → list → content (stacked navigation)
 *
 * Data:
 *   All mail loaded once at boot by MailManager (data/mail/*.json).
 *   Read/starred/archived state persisted via StorageManager.
 *
 * Events consumed:
 *   mail:loaded            — refresh list once data arrives
 *   mail:read / mail:unread / mail:starred / mail:unstarred / mail:archived
 *                           — keep UI in sync with MailManager state
 *   mail:focus-request     — select and scroll to a specific mail
 *                             (fired by Workstation after case:started)
 *
 * Rules:
 *   Never access localStorage directly — use MailManager / StorageManager.
 *   Never call other applications directly — use EventBus.
 */

import BaseApp     from '../../core/BaseApp.js';
import EventBus    from '../../core/EventBus.js';
import MailManager from '../../managers/MailManager.js';

// Folder definitions — order determines sidebar order.
const FOLDERS = [
    { id: 'inbox',    label: 'Inbox',   emoji: '📥' },
    { id: 'starred',  label: 'Starred', emoji: '⭐' },
    { id: 'archived', label: 'Archive', emoji: '🗄️' },
    { id: 'sent',     label: 'Sent',    emoji: '📤', readOnly: true },
];

const PRIORITY_CLASS = {
    High:   'mail-priority--high',
    Medium: 'mail-priority--medium',
    Low:    'mail-priority--low',
};

const ATTACHMENT_EMOJI = {
    pdf:      '📄',
    image:    '🖼️',
    document: '📋',
    lab:      '🧪',
    cctv:     '📹',
};

class PoliceMail extends BaseApp {

    constructor( config ) {
        super( config );

        /** Currently selected folder id. @type {string} */
        this._activeFolder = 'inbox';

        /** Currently selected mail id. @type {string|null} */
        this._selectedMailId = null;

        /** Current search query. @type {string} */
        this._searchQuery = '';

        // DOM refs.
        this._sidebarEl  = null;
        this._listEl     = null;
        this._contentEl_ = null; // avoid clashing with BaseApp._contentEl
        this._searchInput = null;

        // Bound EventBus handlers — stored for clean removal in close().
        this._onMailLoaded  = () => this._refreshList();
        this._onMailChanged = () => this._refreshList();
        this._onFocusRequest = ( { mailId } ) => this._focusMail( mailId );

    }

    // ─────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────

    create( contentEl ) {

        contentEl.classList.add( 'mail' );
        this._buildLayout( contentEl );

    }

    open() {

        EventBus.on( 'mail:loaded',      this._onMailLoaded   );
        EventBus.on( 'mail:read',        this._onMailChanged  );
        EventBus.on( 'mail:unread',      this._onMailChanged  );
        EventBus.on( 'mail:starred',     this._onMailChanged  );
        EventBus.on( 'mail:unstarred',   this._onMailChanged  );
        EventBus.on( 'mail:archived',    this._onMailChanged  );
        EventBus.on( 'mail:unarchived',  this._onMailChanged  );
        EventBus.on( 'mail:focus-request', this._onFocusRequest );

        this._refreshList();

    }

    close() {

        EventBus.off( 'mail:loaded',      this._onMailLoaded   );
        EventBus.off( 'mail:read',        this._onMailChanged  );
        EventBus.off( 'mail:unread',      this._onMailChanged  );
        EventBus.off( 'mail:starred',     this._onMailChanged  );
        EventBus.off( 'mail:unstarred',   this._onMailChanged  );
        EventBus.off( 'mail:archived',    this._onMailChanged  );
        EventBus.off( 'mail:unarchived',  this._onMailChanged  );
        EventBus.off( 'mail:focus-request', this._onFocusRequest );

    }

    minimize() {}
    restore()  { this._refreshList(); }

    destroy() {
        this._sidebarEl   = null;
        this._listEl      = null;
        this._contentEl_  = null;
        this._searchInput = null;
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
        this._sidebarEl.className = 'mail__sidebar';
        this._sidebarEl.setAttribute( 'aria-label', 'Mail folders' );

        FOLDERS.forEach( folder => {
            const btn = document.createElement( 'button' );
            btn.className      = 'mail__folder-btn';
            btn.dataset.folder = folder.id;
            btn.setAttribute( 'type', 'button' );
            btn.innerHTML = `
                <span class="mail__folder-emoji">${ folder.emoji }</span>
                <span class="mail__folder-label">${ folder.label }</span>
                <span class="mail__folder-count" data-folder-count="${ folder.id }"></span>
            `;
            btn.addEventListener( 'click', () => this._selectFolder( folder.id ) );
            this._sidebarEl.appendChild( btn );
        } );

        // ── List Panel (search + email list) ──────────────────────
        const listPanel = document.createElement( 'div' );
        listPanel.className = 'mail__list-panel';

        const searchWrap = document.createElement( 'div' );
        searchWrap.className = 'mail__search-wrap';

        this._searchInput = document.createElement( 'input' );
        this._searchInput.type        = 'text';
        this._searchInput.className   = 'mail__search-input';
        this._searchInput.placeholder = 'Search mail...';
        this._searchInput.setAttribute( 'aria-label', 'Search mail' );

        this._searchInput.addEventListener( 'input', () => {
            this._searchQuery = this._searchInput.value;
            this._refreshList();
        } );

        searchWrap.appendChild( this._searchInput );

        this._listEl = document.createElement( 'div' );
        this._listEl.className = 'mail__list';
        this._listEl.setAttribute( 'role', 'list' );

        listPanel.appendChild( searchWrap );
        listPanel.appendChild( this._listEl );

        // ── Content Panel ────────────────────────────────────────
        this._contentEl_ = document.createElement( 'div' );
        this._contentEl_.className = 'mail__content';
        this._contentEl_.setAttribute( 'aria-live', 'polite' );
        this._renderEmptyContent();

        // ── Phone: back button bridges list ↔ content ─────────────
        contentEl.appendChild( this._sidebarEl );
        contentEl.appendChild( listPanel );
        contentEl.appendChild( this._contentEl_ );

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
        this._searchQuery  = '';
        if ( this._searchInput ) this._searchInput.value = '';

        this._updateFolderActiveState();
        this._refreshList();

        // Phone: navigate to list view.
        if ( this._contentEl_ ) {
            this._contentEl_.classList.remove( 'mail__content--phone-active' );
        }
        if ( this._sidebarEl ) {
            this._sidebarEl.classList.remove( 'mail__sidebar--phone-active' );
        }

    }

    /**
     * Update sidebar button active states and unread counts.
     *
     * @returns {void}
     */
    _updateFolderActiveState() {

        if ( !this._sidebarEl ) return;

        this._sidebarEl.querySelectorAll( '.mail__folder-btn' ).forEach( btn => {
            const isActive = btn.dataset.folder === this._activeFolder;
            btn.classList.toggle( 'mail__folder-btn--active', isActive );
        } );

        // Unread badge — only meaningful for inbox.
        const inboxCount = this._sidebarEl.querySelector( '[data-folder-count="inbox"]' );
        if ( inboxCount ) {
            const unread = MailManager.getUnreadCount();
            inboxCount.textContent = unread > 0 ? String( unread ) : '';
        }

    }

    /**
     * Re-fetch the current folder/search results and re-render the list.
     *
     * @returns {void}
     */
    _refreshList() {

        if ( !this._listEl ) return;

        const mails = this._searchQuery.trim()
            ? MailManager.search( this._searchQuery )
            : MailManager.getFolder( this._activeFolder );

        this._listEl.innerHTML = '';

        if ( mails.length === 0 ) {
            const empty = document.createElement( 'div' );
            empty.className   = 'mail__list-empty';
            empty.textContent = this._searchQuery
                ? 'No messages match your search.'
                : 'No messages in this folder.';
            this._listEl.appendChild( empty );
            this._updateFolderActiveState();
            return;
        }

        mails.forEach( mail => {
            this._listEl.appendChild( this._buildListItem( mail ) );
        } );

        this._updateFolderActiveState();

        // Re-apply selection highlight if the selected mail is still visible.
        if ( this._selectedMailId ) {
            const el = this._listEl.querySelector( `[data-mail-id="${ this._selectedMailId }"]` );
            if ( el ) el.classList.add( 'mail__list-item--selected' );
        }

    }

    /**
     * Build a single email list item.
     *
     * @param {Object} mail
     * @returns {HTMLElement}
     */
    _buildListItem( mail ) {

        const item = document.createElement( 'div' );
        item.className = 'mail__list-item';
        item.dataset.mailId = mail.id;
        item.setAttribute( 'role', 'listitem' );
        item.setAttribute( 'tabindex', '0' );

        if ( !mail.read ) item.classList.add( 'mail__list-item--unread' );

        const priorityClass = PRIORITY_CLASS[ mail.priority ] ?? '';

        item.innerHTML = `
            <div class="mail__list-item-row1">
                <span class="mail__list-item-dot" aria-hidden="true"></span>
                <span class="mail__list-item-from">${ this._escape( mail.from ) }</span>
                <span class="mail__list-item-date">${ this._formatDate( mail.date ) }</span>
            </div>
            <div class="mail__list-item-row2">
                <span class="mail__list-item-subject">${ this._escape( mail.subject ) }</span>
            </div>
            <div class="mail__list-item-row3">
                <span class="mail-priority-badge ${ priorityClass }">${ mail.priority }</span>
                ${ mail.starred ? '<span class="mail__list-item-star" aria-hidden="true">⭐</span>' : '' }
                ${ ( mail.attachments?.length ?? 0 ) > 0 ? '<span class="mail__list-item-attach" aria-hidden="true">📎</span>' : '' }
            </div>
        `;

        item.addEventListener( 'click', () => this._selectMail( mail.id ) );
        item.addEventListener( 'keydown', ( e ) => {
            if ( e.key === 'Enter' || e.key === ' ' ) {
                e.preventDefault();
                this._selectMail( mail.id );
            }
        } );

        return item;

    }

    // ─────────────────────────────────────────────────────────────
    // Email Selection / Content
    // ─────────────────────────────────────────────────────────────

    /**
     * Select a mail, mark it read, and render its content.
     *
     * @param {string} mailId
     * @returns {void}
     */
    _selectMail( mailId ) {

        const mail = MailManager.getById( mailId );
        if ( !mail ) return;

        this._selectedMailId = mailId;

        // Highlight in list.
        this._listEl.querySelectorAll( '.mail__list-item' ).forEach( el => {
            el.classList.toggle( 'mail__list-item--selected', el.dataset.mailId === mailId );
        } );

        // Mark read (no-op if already read or this is the Sent folder).
        if ( !mail.read && mail.folder !== 'sent' ) {
            MailManager.markRead( mailId );
        }

        this._renderMailContent( mail );

        EventBus.emit( 'mail:selected', { mail } );

        // Phone: navigate to content view.
        if ( this._contentEl_ ) {
            this._contentEl_.classList.add( 'mail__content--phone-active' );
        }

    }

    /**
     * Render the full content of a selected mail in the right panel.
     *
     * @param {Object} mail
     * @returns {void}
     */
    _renderMailContent( mail ) {

        if ( !this._contentEl_ ) return;

        const priorityClass = PRIORITY_CLASS[ mail.priority ] ?? '';
        const isSent         = mail.folder === 'sent';

        this._contentEl_.innerHTML = `
            <div class="mail__content-toolbar">
                <button type="button" class="mail__content-back" aria-label="Back to list">← Back</button>
                <div class="mail__content-actions"></div>
            </div>
            <div class="mail__content-header">
                <div class="mail__content-subject">${ this._escape( mail.subject ) }</div>
                <div class="mail__content-meta">
                    <span class="mail__content-from">
                        ${ this._escape( mail.from ) }
                        ${ mail.fromTitle ? `<span class="mail__content-from-title">— ${ this._escape( mail.fromTitle ) }</span>` : '' }
                    </span>
                    <span class="mail__content-date">${ this._formatDate( mail.date, true ) }</span>
                </div>
                <span class="mail-priority-badge ${ priorityClass }">${ mail.priority } Priority</span>
            </div>
            <div class="mail__content-body"></div>
            <div class="mail__content-attachments"></div>
        `;

        // Body — set via textContent-safe line breaks (no HTML injection from data).
        const bodyEl = this._contentEl_.querySelector( '.mail__content-body' );
        bodyEl.textContent = mail.body ?? '';

        // Actions toolbar.
        const actionsEl = this._contentEl_.querySelector( '.mail__content-actions' );
        if ( !isSent ) {
            actionsEl.appendChild( this._buildActionButton(
                mail.read ? '✉️ Mark Unread' : '📖 Mark Read',
                () => mail.read ? MailManager.markUnread( mail.id ) : MailManager.markRead( mail.id )
            ) );
            actionsEl.appendChild( this._buildActionButton(
                mail.starred ? '⭐ Unstar' : '☆ Star',
                () => MailManager.toggleStar( mail.id )
            ) );
            if ( mail.archived ) {
                actionsEl.appendChild( this._buildActionButton(
                    '📤 Unarchive', () => MailManager.unarchive( mail.id )
                ) );
            }
            else {
                actionsEl.appendChild( this._buildActionButton(
                    '🗄️ Archive', () => MailManager.archive( mail.id )
                ) );
            }
        }

        // Back button — phone navigation.
        this._contentEl_.querySelector( '.mail__content-back' )
            .addEventListener( 'click', () => {
                this._contentEl_.classList.remove( 'mail__content--phone-active' );
            } );

        // Attachments.
        const attachEl = this._contentEl_.querySelector( '.mail__content-attachments' );
        if ( mail.attachments && mail.attachments.length > 0 ) {

            const heading = document.createElement( 'div' );
            heading.className   = 'mail__attachments-heading';
            heading.textContent = `Attachments (${ mail.attachments.length })`;
            attachEl.appendChild( heading );

            const list = document.createElement( 'div' );
            list.className = 'mail__attachments-list';

            mail.attachments.forEach( att => {
                list.appendChild( this._buildAttachmentChip( att ) );
            } );

            attachEl.appendChild( list );

        }

    }

    /**
     * Render the empty-state right panel (no mail selected).
     *
     * @returns {void}
     */
    _renderEmptyContent() {

        if ( !this._contentEl_ ) return;

        this._contentEl_.innerHTML = `
            <div class="mail__content-empty">
                <div class="mail__content-empty-emoji">✉️</div>
                <div class="mail__content-empty-text">Select a message to read</div>
            </div>
        `;

    }

    /**
     * Build a single toolbar action button.
     *
     * @param {string}   label
     * @param {Function} onClick
     * @returns {HTMLElement}
     */
    _buildActionButton( label, onClick ) {

        const btn = document.createElement( 'button' );
        btn.className   = 'mail__action-btn';
        btn.textContent = label;
        btn.setAttribute( 'type', 'button' );
        btn.addEventListener( 'click', onClick );
        return btn;

    }

    /**
     * Build a clickable attachment chip that opens a placeholder preview.
     *
     * @param {Object} attachment - { id, name, type }
     * @returns {HTMLElement}
     */
    _buildAttachmentChip( attachment ) {

        const chip = document.createElement( 'button' );
        chip.className = 'mail__attachment-chip';
        chip.setAttribute( 'type', 'button' );

        const emoji = ATTACHMENT_EMOJI[ attachment.type ] ?? '📎';

        chip.innerHTML = `
            <span class="mail__attachment-emoji">${ emoji }</span>
            <span class="mail__attachment-name">${ this._escape( attachment.name ) }</span>
        `;

        chip.addEventListener( 'click', () => this._openAttachmentPreview( attachment ) );

        return chip;

    }

    // ─────────────────────────────────────────────────────────────
    // Attachment Preview (placeholder window)
    // ─────────────────────────────────────────────────────────────

    /**
     * Handle an attachment chip click.
     *
     * Mission 08+: If an evidence item in the Evidence Database is linked
     * to this attachment via sourceAttachmentId, open Evidence Database and
     * focus that item (via 'mail:attachment-opened' event).
     *
     * Fallback: open a standalone placeholder preview window.
     *
     * @param {Object} attachment - { id, name, type }
     * @returns {void}
     */
    _openAttachmentPreview( attachment ) {

        // CCTV attachments open the CCTV Viewer at the specified camera/timestamp.
        if ( attachment.type === 'cctv' ) {
            EventBus.emit( 'mail:cctv-opened', {
                cameraId:  attachment.cameraId,
                timestamp: attachment.timestamp ?? 0,
            } );
            return;
        }

        // Notify Evidence Database so it can focus the linked evidence item.
        EventBus.emit( 'mail:attachment-opened', { attachmentId: attachment.id } );

        // Open a standalone placeholder preview window.
        import( '../../managers/WindowManager.js' ).then( ( { default: WindowManager } ) => {

            const winId = `attachment-${ attachment.id }`;

            if ( WindowManager.isOpen( winId ) ) {
                WindowManager.focus( winId );
                return;
            }

            const emoji = ATTACHMENT_EMOJI[ attachment.type ] ?? '📎';

            const win = WindowManager.create( winId, {
                title:  attachment.name,
                emoji:  emoji,
                width:  420,
                height: 320,
            } );

            if ( win && win.contentEl ) {
                win.contentEl.innerHTML = `
                    <div class="baseapp-placeholder">
                        <div class="baseapp-placeholder__emoji">${ emoji }</div>
                        <div class="baseapp-placeholder__title">${ this._escape( attachment.name ) }</div>
                        <div class="baseapp-placeholder__sub">
                            This attachment is a view-only placeholder.<br>
                            Real file content will be available in a future mission.
                        </div>
                    </div>
                `;
            }

        } );

    }

    // ─────────────────────────────────────────────────────────────
    // Case Integration
    // ─────────────────────────────────────────────────────────────

    /**
     * Select and scroll to a specific mail — called when Workstation
     * routes a 'mail:focus-request' after a case starts.
     *
     * @param {string} mailId
     * @returns {void}
     */
    _focusMail( mailId ) {

        const mail = MailManager.getById( mailId );
        if ( !mail ) return;

        // Switch to whichever folder contains this mail.
        if ( mail.archived ) {
            this._selectFolder( 'archived' );
        }
        else if ( mail.folder === 'sent' ) {
            this._selectFolder( 'sent' );
        }
        else {
            this._selectFolder( 'inbox' );
        }

        this._selectMail( mailId );

        const el = this._listEl.querySelector( `[data-mail-id="${ mailId }"]` );
        if ( el ) {
            el.scrollIntoView( { block: 'nearest' } );
            el.classList.add( 'mail__list-item--highlight-flash' );
            setTimeout( () => el.classList.remove( 'mail__list-item--highlight-flash' ), 1200 );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Format a "YYYY-MM-DD HH:MM" date string for display.
     *
     * @param {string}  dateStr
     * @param {boolean} [full] - If true, include full date; else short form.
     * @returns {string}
     */
    _formatDate( dateStr, full = false ) {

        const [ datePart, timePart ] = dateStr.split( ' ' );
        if ( !datePart ) return dateStr;

        if ( full ) return `${ datePart } at ${ timePart ?? '' }`;

        // Short form: just the time for list rows.
        return timePart ?? datePart;

    }

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

export default PoliceMail;
