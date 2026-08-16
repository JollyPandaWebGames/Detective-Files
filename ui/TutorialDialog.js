/**
 * TutorialDialog
 *
 * Purpose:
 *   Reusable dialogue-box UI for guided tutorials. Renders BOTH
 *   detectives side by side (left/right), emphasizing whichever one
 *   is currently speaking, plus the message text and a Continue/Skip
 *   control. Also renders the lightweight "instruction banner" shown
 *   while the player performs a required action, and a resume prompt
 *   shown when an interrupted tutorial run is found on load.
 *
 * Responsibilities:
 *   - Mount/unmount its own DOM
 *   - Render one dialogue node at a time, with both speaker portraits
 *     always visible so the "two detectives talking" framing holds
 *     even while one of them is silent
 *   - Render one instruction banner at a time
 *   - Render the "Continue Training / Restart Tutorial" resume prompt
 *   - Report Continue / Skip / Resume choice back to its owner via
 *     callbacks
 *
 * Rules:
 *   TutorialDialog holds no tutorial state of its own — it is a pure
 *   view. TutorialManager decides what to show and when.
 *
 * Usage:
 *   TutorialDialog.showDialogue(
 *       { speakers: { id: {name, emoji} }, activeSpeaker: id, text },
 *       { onContinue, onSkip }
 *   );
 *   TutorialDialog.showInstruction( 'Open Case Management.' );
 *   TutorialDialog.showResumePrompt( { onContinue, onRestart } );
 *   TutorialDialog.hide();
 */

class TutorialDialogClass {

    constructor() {

        /** @type {HTMLElement|null} */
        this._element = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Render a single dialogue line with a Continue button (and an
     * optional Skip button). Both detectives are always shown; the
     * one who isn't speaking is visually de-emphasized (EPIC Part 5).
     *
     * @param {{speakers: Object<string,{name:string,emoji:string}>, activeSpeaker:string, text:string}} content
     * @param {{onContinue:Function, onSkip?:Function}}                                                  handlers
     * @returns {void}
     */
    showDialogue( content, handlers ) {

        this._mount();

        const ids = Object.keys( content.speakers );
        // Stable left/right order regardless of who's speaking, per
        // EPIC Part 5 layout (male left, female right when both are
        // known; otherwise just keep declaration order).
        const order = [ 'male-detective', 'female-detective' ]
            .filter( id => ids.includes( id ) )
            .concat( ids.filter( id => id !== 'male-detective' && id !== 'female-detective' ) );

        const active = content.speakers[ content.activeSpeaker ];

        const portraits = order.map( id => {
            const s = content.speakers[ id ];
            const isActive = id === content.activeSpeaker;
            return `
                <div class="tutorial-dialog__portrait-slot ${ isActive ? 'tutorial-dialog__portrait-slot--active' : 'tutorial-dialog__portrait-slot--dim' }">
                    <div class="tutorial-dialog__portrait" aria-hidden="true">${ s.emoji }</div>
                    <div class="tutorial-dialog__portrait-name">${ this._escape( s.name ) }</div>
                </div>
            `;
        } ).join( '' );

        this._element.className = 'tutorial-dialog';
        this._element.innerHTML = `
            <div class="tutorial-dialog__portraits">${ portraits }</div>
            <div class="tutorial-dialog__body">
                <div class="tutorial-dialog__speaker">${ this._escape( active.name ) }</div>
                <div class="tutorial-dialog__text">${ this._escape( content.text ) }</div>
                <div class="tutorial-dialog__actions">
                    ${ handlers.onSkip ? '<button type="button" class="tutorial-dialog__skip">Skip Tutorial</button>' : '' }
                    <button type="button" class="tutorial-dialog__continue">Continue ▸</button>
                </div>
            </div>
        `;

        const continueBtn = this._element.querySelector( '.tutorial-dialog__continue' );
        continueBtn.addEventListener( 'click', handlers.onContinue );
        continueBtn.focus();

        if ( handlers.onSkip ) {
            this._element.querySelector( '.tutorial-dialog__skip' )
                .addEventListener( 'click', handlers.onSkip );
        }

    }

    /**
     * Render the "Welcome back" resume prompt shown when the player
     * returns to a Case 00 tutorial run that was left mid-sequence
     * (EPIC Part 11). Neither option is chosen automatically.
     *
     * @param {{onContinue:Function, onRestart:Function}} handlers
     * @returns {void}
     */
    showResumePrompt( handlers ) {

        this._mount();

        this._element.className = 'tutorial-dialog tutorial-dialog--resume';
        this._element.innerHTML = `
            <div class="tutorial-dialog__portrait" aria-hidden="true">🕵️</div>
            <div class="tutorial-dialog__body">
                <div class="tutorial-dialog__speaker">Welcome back, Detective.</div>
                <div class="tutorial-dialog__text">You were in the middle of your training.</div>
                <div class="tutorial-dialog__actions">
                    <button type="button" class="tutorial-dialog__skip">Restart Tutorial</button>
                    <button type="button" class="tutorial-dialog__continue">Continue Training ▸</button>
                </div>
            </div>
        `;

        const continueBtn = this._element.querySelector( '.tutorial-dialog__continue' );
        const restartBtn  = this._element.querySelector( '.tutorial-dialog__skip' );

        continueBtn.addEventListener( 'click', handlers.onContinue );
        restartBtn.addEventListener( 'click', handlers.onRestart );
        continueBtn.focus();

    }

    /**
     * Render a short floating instruction banner (used while the
     * dialogue box is temporarily closed and the player must perform
     * the required action — see EPIC Part 3/6).
     *
     * @param {string} text
     * @returns {void}
     */
    showInstruction( text ) {

        this._mount();

        this._element.className = 'tutorial-dialog tutorial-dialog--instruction';
        this._element.innerHTML = `
            <div class="tutorial-dialog__instruction-icon" aria-hidden="true">👉</div>
            <div class="tutorial-dialog__instruction-text">${ this._escape( text ) }</div>
        `;

    }

    /**
     * Remove the dialog/instruction UI from the DOM.
     *
     * @returns {void}
     */
    hide() {

        if ( this._element && this._element.parentNode ) {
            this._element.parentNode.removeChild( this._element );
        }
        this._element = null;

    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * Ensure the root element exists and is mounted.
     *
     * @returns {void}
     */
    _mount() {

        if ( this._element ) return;

        this._element = document.createElement( 'div' );
        document.body.appendChild( this._element );

    }

    /**
     * Escape user-facing text before inserting as HTML.
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

const TutorialDialog = new TutorialDialogClass();
export default TutorialDialog;
