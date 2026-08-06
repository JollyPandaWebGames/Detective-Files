/**
 * StateTimerScheduler
 *
 * Purpose:
 *   Mission 18 — Investigation State Machine. Owns the live `setTimeout`
 *   handles for the currently-active state's timers. Extracted from
 *   StateMachineManager purely to keep that class under
 *   CODING_STYLE.md's 500-line class limit — persistence (the
 *   `pendingTimers` record that survives a refresh) still lives on
 *   StateMachineManager, since that's a case-scoped concern this
 *   scheduler has no business knowing about.
 *
 * Responsibilities:
 *   - Arm a timer: schedule a callback after a delay, tracking the handle
 *   - Cancel a single timer or every currently-armed timer
 *
 * Rules:
 *   Never persists anything — the caller owns that.
 *   Never investigation-specific — generic delay/callback bookkeeping.
 */

class StateTimerScheduler {

    constructor() {
        /** @type {Map<string,number>} timerId -> setTimeout handle */
        this._handles = new Map();
    }

    /**
     * @param {string}   timerId
     * @param {number}   delayMs
     * @param {Function} onFire - Called with no arguments when the delay elapses.
     * @returns {void}
     */
    arm( timerId, delayMs, onFire ) {

        this.cancel( timerId );

        const handle = setTimeout( () => {
            this._handles.delete( timerId );
            onFire();
        }, delayMs );

        this._handles.set( timerId, handle );

    }

    /** @param {string} timerId @returns {void} */
    cancel( timerId ) {
        if ( !this._handles.has( timerId ) ) return;
        clearTimeout( this._handles.get( timerId ) );
        this._handles.delete( timerId );
    }

    /** @returns {void} */
    cancelAll() {
        for ( const handle of this._handles.values() ) clearTimeout( handle );
        this._handles.clear();
    }

}

export default StateTimerScheduler;
