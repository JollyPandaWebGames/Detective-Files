/**
 * VersionManager
 *
 * Purpose:
 *   The single authority for the current project version.
 *   Every UI surface that displays a version number (Splash Screen,
 *   Settings → About, taskbar, etc.) reads from here instead of
 *   hardcoding a version string.
 *
 * Responsibilities:
 *   - Load /VERSION.json once at startup
 *   - Expose the parsed version synchronously after load
 *   - Provide a formatted "vX.Y.Z" display string
 *
 * Rules:
 *   VERSION.json is the only place the version number is written.
 *   Nothing else in the codebase may hardcode a version string —
 *   see docs/VERSIONING.md.
 *
 * Usage:
 *   await VersionManager.initialize();
 *   VersionManager.getDisplayVersion();  // "v1.1.0"
 */

const VERSION_URL = './VERSION.json';

// Fallback used only if VERSION.json fails to load (e.g. offline dev
// server misconfiguration). Keeps the UI from showing "undefined".
const FALLBACK_VERSION = { version: '0.0.0', major: 0, minor: 0, patch: 0 };

class VersionManagerClass {

    constructor() {

        /** @type {boolean} */
        this._loaded = false;

        /** @type {{version:string,major:number,minor:number,patch:number,codename?:string,releasedAt?:string}} */
        this._data = FALLBACK_VERSION;

    }

    /**
     * Load VERSION.json. Safe to call multiple times — only fetches once.
     *
     * @returns {Promise<void>}
     */
    async initialize() {

        if ( this._loaded ) return;

        try {

            const res = await fetch( VERSION_URL );
            if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );

            this._data = await res.json();

        } catch ( error ) {
            console.warn( 'VersionManager: Failed to load VERSION.json, using fallback.', error );
            this._data = FALLBACK_VERSION;
        }

        this._loaded = true;

    }

    /**
     * Raw version data ({ version, major, minor, patch, codename, releasedAt }).
     *
     * @returns {Object}
     */
    getVersionData() {
        return this._data;
    }

    /**
     * Bare semantic version string, e.g. "1.1.0".
     *
     * @returns {string}
     */
    getVersion() {
        return this._data.version;
    }

    /**
     * Display-formatted version string, e.g. "v1.1.0".
     *
     * @returns {string}
     */
    getDisplayVersion() {
        return `v${ this._data.version }`;
    }

}

const VersionManager = new VersionManagerClass();
export default VersionManager;
