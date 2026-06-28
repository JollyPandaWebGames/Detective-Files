/**
 * TestWindows
 *
 * Purpose:
 *   Temporary test harness for Mission 03.
 *   Creates test launcher buttons on the desktop so the window system
 *   can be exercised without real application integration.
 *
 * Responsibilities:
 *   - Render three test launcher buttons on the desktop
 *   - Open test windows via WindowManager when clicked
 *   - Remove itself cleanly in Mission 04 when real apps take over
 *
 * Rules:
 *   This file is TEMPORARY — removed in Mission 04.
 *   It must not modify any manager or core system.
 *   It communicates with WindowManager only.
 *
 * Dependencies:
 *   WindowManager — to create test windows
 *   DesktopManager — to obtain a mount point for the test buttons
 */

import WindowManager  from '../managers/WindowManager.js';
import DesktopManager from '../managers/DesktopManager.js';

// Test window definitions.
const TEST_WINDOWS = [
    {
        id:     'test-window-a',
        title:  'Window A — Case Management',
        width:  580,
        height: 400,
    },
    {
        id:     'test-window-b',
        title:  'Window B — Police Mail',
        width:  520,
        height: 380,
    },
    {
        id:     'test-window-c',
        title:  'Window C — Evidence Database',
        width:  600,
        height: 440,
    },
];

class TestWindowsClass {

    constructor() {

        /**
         * The test launcher bar element.
         * @type {HTMLElement|null}
         */
        this._bar = null;

    }

    /**
     * Initialize the test launcher bar.
     * Called by Workstation after the desktop is visible.
     *
     * @returns {void}
     */
    initialize() {

        this._injectStyles();
        this._buildLauncher();

        console.info( 'TestWindows: Test launcher initialized. Remove in Mission 04.' );

    }

    // ─────────────────────────────────────────────────────────────
    // DOM
    // ─────────────────────────────────────────────────────────────

    /**
     * Build and mount the test launcher strip onto the desktop icon area.
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

        TEST_WINDOWS.forEach( ( config ) => {

            const btn = document.createElement( 'button' );
            btn.className   = 'test-launcher__btn';
            btn.textContent = config.title.split( '—' )[ 0 ].trim();
            btn.setAttribute( 'title', `Open ${ config.title }` );

            btn.addEventListener( 'click', () => {

                if ( WindowManager.isOpen( config.id ) ) {
                    // If minimized, restore; otherwise just focus.
                    if ( WindowManager.isMinimized( config.id ) ) {
                        WindowManager.restore( config.id );
                    }
                    else {
                        WindowManager.focus( config.id );
                    }
                }
                else {
                    WindowManager.create( config.id, config );
                }

            } );

            this._bar.appendChild( btn );

        } );

        // Mount onto the desktop (above icons, bottom-right area).
        const iconArea = DesktopManager.getIconArea();
        if ( iconArea ) {
            iconArea.appendChild( this._bar );
        }

    }

    /**
     * Inject test launcher styles into the document head.
     *
     * @returns {void}
     */
    _injectStyles() {

        const style = document.createElement( 'style' );
        style.id = 'test-launcher-styles';
        style.textContent = `
            /* ── TestWindows — temporary Mission 03 styles ── */
            .test-launcher {
                position:    absolute;
                bottom:      var(--space-4);
                right:       var(--space-4);
                display:     flex;
                align-items: center;
                gap:         var(--space-2);
                background:  var(--color-bg-secondary);
                border:      2px solid var(--color-border-window);
                padding:     var(--space-2) var(--space-3);
                z-index:     50;
            }

            .test-launcher__label {
                font-family:  var(--font-ui), monospace;
                font-size:    var(--font-size-xs);
                color:        var(--color-text-secondary);
                margin-right: var(--space-1);
            }

            .test-launcher__btn {
                padding:     var(--space-1) var(--space-3);
                background:  var(--color-bg-primary);
                border:      1px solid var(--color-border-window);
                color:       var(--color-text-primary);
                font-family: var(--font-ui), monospace;
                font-size:   var(--font-size-xs);
                cursor:      pointer;
                transition:  background var(--duration-fast) linear;
                outline:     none;
            }

            .test-launcher__btn:hover {
                background:  var(--color-titlebar);
                border-color: var(--color-highlight);
                color:        var(--color-highlight);
            }

            .test-launcher__btn:active {
                background:  var(--color-titlebar-active);
            }

            .test-launcher__btn:focus-visible {
                outline: 2px solid var(--color-highlight);
                outline-offset: 2px;
            }
        `;

        document.head.appendChild( style );

    }

}

// Singleton — one test launcher instance.
const TestWindows = new TestWindowsClass();

export default TestWindows;
