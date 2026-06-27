/**
 * EventBus
 *
 * Purpose:
 *   Provides decoupled, publish-subscribe communication across
 *   all workstation modules and applications.
 *
 * Responsibilities:
 *   - Register event listeners (on, once)
 *   - Emit events with optional payloads (emit)
 *   - Remove event listeners (off)
 *   - Prevent direct coupling between applications
 *
 * Rules:
 *   Applications must never call each other directly.
 *   All cross-module communication goes through EventBus.
 *
 * Usage:
 *   EventBus.on('mail:new', handler);
 *   EventBus.emit('mail:new', { subject: 'Case Assigned' });
 *   EventBus.off('mail:new', handler);
 */

class EventBusClass {

    constructor() {

        /**
         * Internal listener registry.
         * Structure: Map<eventName, Set<handler>>
         * @type {Map<string, Set<Function>>}
         */
        this._listeners = new Map();

    }

    /**
     * Subscribe to an event.
     * The handler will be called every time the event is emitted.
     *
     * @param {string}   eventName - The event identifier.
     * @param {Function} handler   - The callback to invoke.
     * @returns {void}
     */
    on( eventName, handler ) {

        if ( !this._listeners.has( eventName ) ) {
            this._listeners.set( eventName, new Set() );
        }

        this._listeners.get( eventName ).add( handler );

    }

    /**
     * Subscribe to an event exactly once.
     * The handler is automatically removed after the first invocation.
     *
     * @param {string}   eventName - The event identifier.
     * @param {Function} handler   - The callback to invoke once.
     * @returns {void}
     */
    once( eventName, handler ) {

        const wrapper = ( payload ) => {
            handler( payload );
            this.off( eventName, wrapper );
        };

        this.on( eventName, wrapper );

    }

    /**
     * Unsubscribe a handler from an event.
     *
     * @param {string}   eventName - The event identifier.
     * @param {Function} handler   - The handler to remove.
     * @returns {void}
     */
    off( eventName, handler ) {

        if ( !this._listeners.has( eventName ) ) {
            return;
        }

        this._listeners.get( eventName ).delete( handler );

    }

    /**
     * Emit an event, invoking all registered handlers.
     *
     * @param {string} eventName - The event identifier.
     * @param {*}      [payload] - Optional data to pass to handlers.
     * @returns {void}
     */
    emit( eventName, payload ) {

        if ( !this._listeners.has( eventName ) ) {
            return;
        }

        for ( const handler of this._listeners.get( eventName ) ) {

            try {
                handler( payload );
            }
            catch ( error ) {
                console.error( `EventBus: Error in handler for "${ eventName }":`, error );
            }

        }

    }

    /**
     * Remove all listeners for a specific event, or all events.
     *
     * @param {string} [eventName] - If omitted, clears all events.
     * @returns {void}
     */
    clear( eventName ) {

        if ( eventName ) {
            this._listeners.delete( eventName );
        }
        else {
            this._listeners.clear();
        }

    }

}

// Singleton — one shared event bus for the entire workstation.
const EventBus = new EventBusClass();

export default EventBus;
