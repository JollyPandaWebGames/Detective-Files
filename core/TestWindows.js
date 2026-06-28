/**
 * TestWindows
 *
 * Purpose:
 *   Temporary test harness for Mission 03.
 *   Bridges desktop icon double-clicks to real window creation,
 *   and provides a dedicated test launcher strip for windows
 *   not covered by the icon grid.
 *
 * Responsibilities:
 *   - Register an EventBus listener for 'application:requested'
 *     so desktop icon double-clicks open test windows
 *   - Maintain a registry of test window configs (id, title, emoji, size)
 *   - Render a test launcher bar with named buttons for all windows
 *   - Toggle between open/focus/restore correctly
 *
 * Rules:
 *   TEMPORARY — removed entirely in Mission 04 when real apps take over.
 *   Must not modify any manager or core system.
 *   Communicates with WindowManager only.
 *
 * Dependencies:
 *   WindowManager  — to create/focus/restore/close test windows
 *   DesktopManager — to obtain the icon area mount point for the launcher bar
 *   EventBus       — to listen for 'application:requested' from desktop icons
 */

import WindowManager  from '../managers/WindowManager.js';
import DesktopManager from '../managers/DesktopManager.js';
import EventBus       from '../core/EventBus.js';

// Test window configs — each maps directly to a desktop icon id.
// Any desktop icon whose id appears here gets a real window on double-click.
const TEST_WINDOW_CONFIGS = [
    {
        id:     'case-management',
        title:  'Case Management',
        emoji:  '🗂️',
        width:  680,
        height: 480,
    },
    {
        id:     'police-mail',
        title:  'Police Mail',
        emoji:  '✉️',
        width:  620,
        height: 440,
    },
    {
        id:     'messenger',
        title:  'Messenger',
        emoji:  '💬',
        width:  560,
        height: 400,
    },
    {
        id:     'evidence',
        title:  'Evidence Database',
        emoji:  '🔍',
        width:  700,
        height: 500,
    },
    {
        id:     'forensics',
        title:  'Forensics Lab',
        emoji:  '🧪',
        width:  640,
        height: 460,
    },
    {
        id:     'cctv',
        title:  'CCTV Viewer',
        emoji:  '📹',
        width:  720,
        height: 480,
    },
    {
        id:     'city-map',
        title:  'City Map',
        emoji:  '🗺️',
        width:  700,
        height: 520,
    },
    {
        id:     'board',
        title:  'Investigation Board',
        emoji:  '📌',
        width:  780,
        height: 560,
    },
    {
        id:     'criminal-database',
        title:  'Criminal Database',
        emoji:  '🗃️',
        width:  640,
        height: 460,
    },
    {
        id:     'settings',
        title:  'Settings',
        emoji:  '⚙️',
        width:  520,
        height: 400,
    },
];

// Build lookup map for O(1) config resolution.
const CONFIG_BY_ID = new Map( TEST_WINDOW_CONFIGS.map( c => [ c.id, c ] ) );

class TestWindowsClass {

    constructor() {

        /** The launcher bar element. @type {HTMLElement|null} */
        this._bar = null;

        /** Bound EventBus listener reference for cleanup. @type {Function|null} */
        this._requestHandler = null;

    }

    /**
     * Initialize the test harness.
     * Called by Workstation after the desktop is visible.
     *
     * @returns {void}
     */
    initialize() {

        this._injectStyles();
        this._buildLauncher();
        this._bindIconEvents();

        console.info( 'TestWindows: Initialized. Remove this module in Mission 04.' );

    }

    // ─────────────────────────────────────────────────────────────
    // Icon Event Bridge
    // ─────────────────────────────────────────────────────────────

    /**
     * Listen for desktop icon double-clicks and open the matching window.
     * Any app id found in CONFIG_BY_ID gets a real window;
     * unknown ids fall through with a console log.
     *
     * @returns {void}
     */
    _bindIconEvents() {

        this._requestHandler = ( { appId } ) => {

            const config = CONFIG_BY_ID.get( appId );

            if ( !config ) {
                console.info( `Opening: ${ appId }` );
                return;
            }

            this._openOrFocus( config );

        };

        EventBus.on( 'application:requested', this._requestHandler );

    }

    // ─────────────────────────────────────────────────────────────
    // Window Management
    // ─────────────────────────────────────────────────────────────

    /**
     * Open, focus, or restore a window based on its current state.
     *
     * @param {Object} config - Test window config.
     * @returns {void}
     */
    _openOrFocus( config ) {

        if ( !WindowManager.isOpen( config.id ) ) {
            WindowManager.create( config.id, config );
            return;
        }

        if ( WindowManager.isMinimized( config.id ) ) {
            WindowManager.restore( config.id );
            return;
        }

        WindowManager.focus( config.id );

    }

    // ─────────────────────────────────────────────────────────────
    // Test Launcher Bar
    // ─────────────────────────────────────────────────────────────

    /**
     * Build and mount the test launcher strip on the desktop icon area.
     * Shows the first three windows as quick-access buttons.
     *
     * @returns {void}
     */
    _buildLauncher() {

        this._bar = document.createElement( 'div' );
        this._bar.className = 'test-launcher';
        this._bar.setAttribute( 'aria-label', 'Test window launcher (Mission 03)' );

        const label = document.createElement( 'span' );
        label.className   = 'test-launcher__label';
        label.textContent = 'Test:';
        this._bar.appendChild( label );

        // Show all windows as compact emoji+name buttons.
        TEST_WINDOW_CONFIGS.forEach( ( config ) => {

            const btn = document.createElement( 'button' );
            btn.className   = 'test-launcher__btn';
            btn.textContent = `${ config.emoji } ${ config.title }`;
            btn.setAttribute( 'title', `Open ${ config.title }` );
            btn.setAttribute( 'type', 'button' );

            btn.addEventListener( 'click', () => this._openOrFocus( config ) );

            this._bar.appendChild( btn );

        } );

        const iconArea = DesktopManager.getIconArea();
        if ( iconArea ) {
            iconArea.appendChild( this._bar );
        }

    }

    // ─────────────────────────────────────────────────────────────
    // Styles
    // ─────────────────────────────────────────────────────────────

    /**
     * Inject temporary inline styles for the test launcher.
     *
     * @returns {void}
     */
    _injectStyles() {

        if ( document.getElementById( 'test-launcher-styles' ) ) return;

        const style = document.createElement( 'style' );
        style.id = 'test-launcher-styles';
        style.textContent = `
            /* ── TestWindows launcher — Mission 03 only ── */
            .test-launcher {
                position:   absolute;
                bottom:     var(--space-4);
                right:      var(--space-4);
                display:    flex;
                flex-wrap:  wrap;
                gap:        var(--space-2);
                max-width:  320px;
                background: var(--color-bg-secondary);
                border:     2px solid var(--color-border-window);
                padding:    var(--space-2) var(--space-3);
                z-index:    50;
            }

            .test-launcher__label {
                font-family: var(--font-ui), monospace;
                font-size:   var(--font-size-xs);
                color:       var(--color-text-secondary);
                align-self:  center;
                flex-shrink: 0;
            }

            .test-launcher__btn {
                padding:     var(--space-1) var(--space-2);
                background:  var(--color-bg-primary);
                border:      1px solid var(--color-border-window);
                color:       var(--color-text-primary);
                font-family: var(--font-ui), monospace;
                font-size:   var(--font-size-xs);
                cursor:      pointer;
                outline:     none;
                white-space: nowrap;
                transition:  background var(--duration-fast) linear;
            }

            .test-launcher__btn:hover {
                background:   var(--color-titlebar);
                border-color: var(--color-highlight);
                color:        var(--color-highlight);
            }

            .test-launcher__btn:active {
                background: var(--color-titlebar-active);
            }

            .test-launcher__btn:focus-visible {
                outline:        2px solid var(--color-highlight);
                outline-offset: 2px;
            }

            /* Hide launcher on phone — rely on icon grid instead */
            @media (max-width: 639px) {
                .test-launcher { display: none; }
            }
        `;

        document.head.appendChild( style );

    }

}

// Singleton.
const TestWindows = new TestWindowsClass();

export default TestWindows;
