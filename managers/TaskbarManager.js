/**
 * TaskbarManager
 *
 * Purpose:
 *   Creates and manages the CID OS taskbar fixed to the bottom
 *   of the desktop. Owns the Start button, system clock,
 *   running applications placeholder, and Start Menu.
 *
 * Responsibilities:
 *   - Build and mount the taskbar DOM into DesktopManager's taskbar slot
 *   - Render the Start button and handle its toggle behaviour
 *   - Build and render the Start Menu from the installed app list
 *   - Maintain the live system clock (24-hour, HH:MM)
 *   - Close menus on outside click and Escape key
 *
 * Rules:
 *   TaskbarManager never launches applications directly.
 *   It emits EventBus events; ApplicationManager handles launching.
 *   Never manage windows or desktop icons here.
 *
 * Dependencies:
 *   EventBus — to request application launches and listen for state
 *   DesktopManager — to receive the taskbar mount element
 */

import EventBus from '../core/EventBus.js';

// Clock update interval in milliseconds.
const CLOCK_INTERVAL_MS = 1000;

class TaskbarManagerClass {

    constructor() {

        /**
         * The taskbar root element provided by DesktopManager.
         * @type {HTMLElement|null}
         */
        this._container = null;

        /**
         * The clock display element.
         * @type {HTMLElement|null}
         */
        this._clockEl = null;

        /**
         * The Start Menu element.
         * @type {HTMLElement|null}
         */
        this._startMenu = null;

        /**
         * Whether the Start Menu is currently open.
         * @type {boolean}
         */
        this._menuOpen = false;

        /**
         * setInterval id for the clock ticker.
         * @type {number|null}
         */
        this._clockTimer = null;

        /**
         * Bound reference to the outside-click handler for cleanup.
         * @type {Function|null}
         */
        this._outsideClickHandler = null;

        /**
         * Bound reference to the keydown handler for cleanup.
         * @type {Function|null}
         */
        this._keydownHandler = null;

        /**
         * The running applications area element.
         * @type {HTMLElement|null}
         */
        this._runningAppsEl = null;

        /**
         * Map of appId → taskbar button element for running apps.
         * @type {Map<string, HTMLElement>}
         */
        this._runningBtns = new Map();

    }

    // ─────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────

    /**
     * Initialize the taskbar inside the provided container element.
     * Called by Workstation after DesktopManager.initialize().
     *
     * @param {HTMLElement} container - The taskbar DOM element from DesktopManager.
     * @param {Object[]}    apps      - Installed app configs from ApplicationManager.
     * @returns {void}
     */
    initialize( container, apps ) {

        this._container = container;
        this._build( apps );
        this._startClock();
        this._bindGlobalEvents();

        console.info( 'TaskbarManager: Taskbar initialized.' );

    }

    /**
     * Cleanly destroy the taskbar and remove all event listeners.
     * Called on workstation shutdown.
     *
     * @returns {void}
     */
    destroy() {

        this._stopClock();

        if ( this._outsideClickHandler ) {
            document.removeEventListener( 'click', this._outsideClickHandler );
        }

        if ( this._keydownHandler ) {
            document.removeEventListener( 'keydown', this._keydownHandler );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Start Menu
    // ─────────────────────────────────────────────────────────────

    /**
     * Toggle the Start Menu open/closed.
     *
     * @returns {void}
     */
    toggleStartMenu() {

        if ( this._menuOpen ) {
            this._closeStartMenu();
        }
        else {
            this._openStartMenu();
        }

    }

    // ─────────────────────────────────────────────────────────────
    // DOM Construction
    // ─────────────────────────────────────────────────────────────

    /**
     * Build the full taskbar DOM and append to the container.
     *
     * @param {Object[]} apps - Installed application configs.
     * @returns {void}
     */
    _build( apps ) {

        // ── Start Button ─────────────────────────────────────────
        const startBtn = document.createElement( 'button' );
        startBtn.className   = 'taskbar__start-btn';
        startBtn.textContent = 'START';
        startBtn.setAttribute( 'aria-haspopup', 'true' );
        startBtn.setAttribute( 'aria-expanded', 'false' );
        startBtn.setAttribute( 'aria-controls', 'start-menu' );
        startBtn.setAttribute( 'title', 'Open Start Menu' );

        startBtn.addEventListener( 'click', ( e ) => {
            e.stopPropagation();
            this.toggleStartMenu();
        } );

        // ── Running Apps Area ─────────────────────────────────────
        const runningArea = document.createElement( 'div' );
        runningArea.className = 'taskbar__running-apps';
        runningArea.setAttribute( 'aria-label', 'Running applications' );
        runningArea.setAttribute( 'id', 'taskbar-running-apps' );

        this._runningAppsEl = runningArea;

        // ── Clock ─────────────────────────────────────────────────
        this._clockEl = document.createElement( 'div' );
        this._clockEl.className = 'taskbar__clock';
        this._clockEl.setAttribute( 'aria-label', 'System clock' );
        this._clockEl.setAttribute( 'aria-live', 'off' );
        this._clockEl.textContent = this._getTimeString();

        // ── Assemble Taskbar ──────────────────────────────────────
        this._container.appendChild( startBtn );
        this._container.appendChild( runningArea );
        this._container.appendChild( this._clockEl );

        // ── Build Start Menu (hidden by default) ──────────────────
        this._startMenu = this._buildStartMenu( apps );
        this._container.appendChild( this._startMenu );

        // Keep reference to start button for aria updates.
        this._startBtn = startBtn;

        // ── Subscribe to app lifecycle events ─────────────────────
        EventBus.on( 'app:opened',    ( p ) => this._addRunningApp( p )    );
        EventBus.on( 'app:closed',    ( p ) => this._removeRunningApp( p ) );
        EventBus.on( 'app:minimized', ( p ) => this._setAppMinimized( p )  );
        EventBus.on( 'app:restored',  ( p ) => this._setAppActive( p )     );
        EventBus.on( 'window:focused', ( p ) => this._setWindowFocused( p ) );

    }

    // ─────────────────────────────────────────────────────────────
    // Running Applications Area
    // ─────────────────────────────────────────────────────────────

    /**
     * Add a button to the running apps area when an app opens.
     *
     * @param {{ appId: string, title: string, emoji: string }} payload
     * @returns {void}
     */
    _addRunningApp( { appId, title, emoji } ) {

        if ( this._runningBtns.has( appId ) ) return;

        const btn = document.createElement( 'button' );
        btn.className = 'taskbar__app-btn';
        btn.dataset.appId = appId;
        btn.setAttribute( 'title', title );
        btn.setAttribute( 'aria-label', title );
        btn.setAttribute( 'type', 'button' );

        const emojiEl = document.createElement( 'span' );
        emojiEl.className   = 'taskbar__app-btn-emoji';
        emojiEl.textContent = emoji ?? '🖥️';

        const labelEl = document.createElement( 'span' );
        labelEl.className   = 'taskbar__app-btn-label';
        labelEl.textContent = title;

        btn.appendChild( emojiEl );
        btn.appendChild( labelEl );

        btn.addEventListener( 'click', ( e ) => {
            e.stopPropagation();
            EventBus.emit( 'application:requested', { appId } );
        } );

        this._runningAppsEl.appendChild( btn );
        this._runningBtns.set( appId, btn );

    }

    /**
     * Remove the running app button when an app closes.
     *
     * @param {{ appId: string }} payload
     * @returns {void}
     */
    _removeRunningApp( { appId } ) {

        const btn = this._runningBtns.get( appId );
        if ( !btn ) return;

        btn.remove();
        this._runningBtns.delete( appId );

    }

    /**
     * Mark a running app button as minimized.
     *
     * @param {{ appId: string }} payload
     * @returns {void}
     */
    _setAppMinimized( { appId } ) {

        const btn = this._runningBtns.get( appId );
        if ( !btn ) return;

        btn.classList.remove( 'taskbar__app-btn--active' );
        btn.classList.add( 'taskbar__app-btn--minimized' );

    }

    /**
     * Mark a running app button as active (restored/focused).
     *
     * @param {{ appId: string }} payload
     * @returns {void}
     */
    _setAppActive( { appId } ) {

        const btn = this._runningBtns.get( appId );
        if ( !btn ) return;

        btn.classList.remove( 'taskbar__app-btn--minimized' );
        btn.classList.add( 'taskbar__app-btn--active' );

    }

    /**
     * Update focused state across all running app buttons.
     * Only the focused window's button gets the active style.
     *
     * @param {{ windowId: string }} payload
     * @returns {void}
     */
    _setWindowFocused( { windowId } ) {

        for ( const [ id, btn ] of this._runningBtns ) {
            if ( id === windowId ) {
                btn.classList.add( 'taskbar__app-btn--active' );
                btn.classList.remove( 'taskbar__app-btn--minimized' );
            }
            else {
                btn.classList.remove( 'taskbar__app-btn--active' );
            }
        }

    }

    /**
     * Build the Start Menu element.
     *
     * @param {Object[]} apps - Installed application configs.
     * @returns {HTMLElement}
     */
    _buildStartMenu( apps ) {

        const menu = document.createElement( 'div' );
        menu.className = 'start-menu';
        menu.id        = 'start-menu';
        menu.setAttribute( 'role', 'menu' );
        menu.setAttribute( 'aria-label', 'Start Menu' );
        menu.setAttribute( 'hidden', '' );

        // ── OS Header ─────────────────────────────────────────────
        const header = document.createElement( 'div' );
        header.className = 'start-menu__header';
        header.innerHTML = `
            <span class="start-menu__header-title">CID OS</span>
            <span class="start-menu__header-sub">v1.0</span>
        `;

        // ── Applications Section ──────────────────────────────────
        const appsSection = this._buildMenuSection( 'Applications', apps, ( app ) => {
            this._closeStartMenu();
            console.info( `Opening: ${ app.id }` );
            EventBus.emit( 'application:requested', { appId: app.id } );
        } );

        // ── System Section ────────────────────────────────────────
        const systemItems = [
            { id: 'settings', title: 'Settings', icon: 'settings.png' },
        ];

        const systemSection = this._buildMenuSection( 'System', systemItems, ( item ) => {
            this._closeStartMenu();
            console.info( `Opening: ${ item.id }` );
            EventBus.emit( 'application:requested', { appId: item.id } );
        } );

        // ── About Section ─────────────────────────────────────────
        const aboutSection = this._buildMenuSection( 'About', [
            { id: 'about', title: 'CID OS v1.0' },
        ], ( item ) => {
            this._closeStartMenu();
            console.info( `Opening: ${ item.id }` );
        } );

        // ── Assemble ──────────────────────────────────────────────
        menu.appendChild( header );
        menu.appendChild( appsSection );
        menu.appendChild( systemSection );
        menu.appendChild( aboutSection );

        return menu;

    }

    /**
     * Build a labelled section inside the Start Menu.
     *
     * @param {string}   label    - Section heading text.
     * @param {Object[]} items    - App/item configs to list.
     * @param {Function} onSelect - Called with the item config on click.
     * @returns {HTMLElement}
     */
    _buildMenuSection( label, items, onSelect ) {

        const section = document.createElement( 'div' );
        section.className = 'start-menu__section';

        const heading = document.createElement( 'div' );
        heading.className   = 'start-menu__section-label';
        heading.textContent = label;
        section.appendChild( heading );

        items.forEach( ( item ) => {

            const entry = document.createElement( 'button' );
            entry.className = 'start-menu__item';
            entry.setAttribute( 'role', 'menuitem' );
            entry.setAttribute( 'tabindex', '-1' );

            const iconEl = document.createElement( 'div' );
            iconEl.className = 'start-menu__item-icon';
            iconEl.setAttribute( 'aria-hidden', 'true' );

            const label = document.createElement( 'span' );
            label.className   = 'start-menu__item-label';
            label.textContent = item.title;

            entry.appendChild( iconEl );
            entry.appendChild( label );

            entry.addEventListener( 'click', ( e ) => {
                e.stopPropagation();
                onSelect( item );
            } );

            section.appendChild( entry );

        } );

        return section;

    }

    // ─────────────────────────────────────────────────────────────
    // Start Menu State
    // ─────────────────────────────────────────────────────────────

    /**
     * Open the Start Menu.
     *
     * @returns {void}
     */
    _openStartMenu() {

        if ( !this._startMenu ) return;

        this._startMenu.removeAttribute( 'hidden' );
        this._startMenu.classList.add( 'start-menu--visible' );
        this._startBtn.setAttribute( 'aria-expanded', 'true' );
        this._startBtn.classList.add( 'taskbar__start-btn--active' );
        this._menuOpen = true;

        // Move focus into the menu for keyboard navigation.
        const firstItem = this._startMenu.querySelector( '.start-menu__item' );
        if ( firstItem ) {
            firstItem.setAttribute( 'tabindex', '0' );
            firstItem.focus();
        }

    }

    /**
     * Close the Start Menu.
     *
     * @returns {void}
     */
    _closeStartMenu() {

        if ( !this._startMenu ) return;

        this._startMenu.setAttribute( 'hidden', '' );
        this._startMenu.classList.remove( 'start-menu--visible' );
        this._startBtn.setAttribute( 'aria-expanded', 'false' );
        this._startBtn.classList.remove( 'taskbar__start-btn--active' );
        this._menuOpen = false;

    }

    // ─────────────────────────────────────────────────────────────
    // Clock
    // ─────────────────────────────────────────────────────────────

    /**
     * Start the clock interval.
     *
     * @returns {void}
     */
    _startClock() {

        this._updateClock();
        this._clockTimer = setInterval( () => this._updateClock(), CLOCK_INTERVAL_MS );

    }

    /**
     * Stop the clock interval.
     *
     * @returns {void}
     */
    _stopClock() {

        if ( this._clockTimer !== null ) {
            clearInterval( this._clockTimer );
            this._clockTimer = null;
        }

    }

    /**
     * Update the clock display with the current time.
     *
     * @returns {void}
     */
    _updateClock() {

        if ( !this._clockEl ) return;
        this._clockEl.textContent = this._getTimeString();

    }

    /**
     * Return the current local time as a HH:MM string (24-hour, no seconds).
     *
     * @returns {string}
     */
    _getTimeString() {

        const now     = new Date();
        const hours   = String( now.getHours() ).padStart( 2, '0' );
        const minutes = String( now.getMinutes() ).padStart( 2, '0' );
        return `${ hours }:${ minutes }`;

    }

    // ─────────────────────────────────────────────────────────────
    // Global Events
    // ─────────────────────────────────────────────────────────────

    /**
     * Bind document-level events for menu dismissal.
     *
     * @returns {void}
     */
    _bindGlobalEvents() {

        // Outside click — close start menu.
        this._outsideClickHandler = () => {
            if ( this._menuOpen ) {
                this._closeStartMenu();
            }
        };

        // Escape — close start menu.
        this._keydownHandler = ( e ) => {
            if ( e.key === 'Escape' && this._menuOpen ) {
                this._closeStartMenu();
                this._startBtn.focus();
            }
        };

        document.addEventListener( 'click', this._outsideClickHandler );
        document.addEventListener( 'keydown', this._keydownHandler );

    }

}

// Singleton — one shared taskbar manager for the entire workstation.
const TaskbarManager = new TaskbarManagerClass();

export default TaskbarManager;
