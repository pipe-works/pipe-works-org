/*
 * mud-api.js
 * MUD API client + session storage helpers.
 *
 * This file is intentionally small and direct because it doubles as
 * documentation for how to talk to the MUD server. It provides the
 * minimal primitives used by the UI layer (mud-auth-ui.js).
 *
 * Responsibility:
 * - Talk to the MUD server for register/login/logout.
 * - Generate a temporary password when one is not provided.
 * - Store and retrieve session details from sessionStorage.
 *
 * Usage:
 *   const MudApi = window.PipeWorksMudApi;
 *   const password = MudApi.randomPassword();
 *   await MudApi.registerAccount({ mudApiBaseUrl, username, password });
 *   const login = await MudApi.login({ mudApiBaseUrl, username, password });
 *   MudApi.writeSession({ session_id: login.session_id, username });
 */

(function () {
  'use strict';

  const DEFAULTS = {
    mudApiBaseUrl: 'https://api.pipe-works.org',
    sessionStorageKey: 'pipeworks_mud_session',
  };

  /**
   * Perform a JSON API request and return parsed data.
   *
   * @param {string} baseUrl - API base (e.g. https://api.pipe-works.org)
   * @param {string} endpoint - Path beginning with "/"
   * @param {RequestInit} options - Fetch options
   * @returns {Promise<object>} Parsed JSON
   * @throws {Error} When response is non-JSON or response.ok is false
   */
  async function apiCall(baseUrl, endpoint, options) {
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Unexpected response (${response.status}): ${text}`);
    }
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error || data?.message || data?.detail || 'Request failed.';
      throw new Error(message);
    }
    return data;
  }

  /**
   * Generates a short, memorable temporary password.
   *
   * Note: these accounts are disposable and there is no recovery,
   * so the UI surfaces the password for the user to copy.
   *
   * @returns {string}
   */
  function randomPassword() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i += 1) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  }

  /**
   * Reads a session payload from sessionStorage.
   *
   * @param {object} [config]
   * @param {string} [config.sessionStorageKey]
   * @returns {object|null} Session payload or null
   */
  function readSession(config = {}) {
    const settings = { ...DEFAULTS, ...config };
    try {
      const raw = sessionStorage.getItem(settings.sessionStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Writes a session payload to sessionStorage.
   *
   * @param {object} payload - Session data
   * @param {object} [config]
   * @param {string} [config.sessionStorageKey]
   */
  function writeSession(payload, config = {}) {
    const settings = { ...DEFAULTS, ...config };
    sessionStorage.setItem(settings.sessionStorageKey, JSON.stringify(payload));
  }

  /**
   * Clears the session payload.
   *
   * @param {object} [config]
   * @param {string} [config.sessionStorageKey]
   */
  function clearSession(config = {}) {
    const settings = { ...DEFAULTS, ...config };
    sessionStorage.removeItem(settings.sessionStorageKey);
  }

  /**
   * Registers a temporary account on the MUD server.
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.username
   * @param {string} params.password
   * @returns {Promise<object>} API response
   */
  async function registerAccount({ mudApiBaseUrl, username, password }) {
    return apiCall(mudApiBaseUrl, '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        password_confirm: password,
      }),
    });
  }

  /**
   * Registers a guest account with a server-generated username.
   *
   * The server requires a password + password_confirm and a character_name.
   * It returns a generated username (guest_XXXXX) on success.
   *
   * Current response shape may also include:
   * - character_id, character_name, world_id
   * - entity_state (axis profile payload)
   * - entity_state_error (non-fatal integration warning)
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.password
   * @param {string} params.passwordConfirm
   * @param {string} params.characterName
   * @returns {Promise<object>} API response
   */
  async function registerGuest({ mudApiBaseUrl, password, passwordConfirm, characterName }) {
    return apiCall(mudApiBaseUrl, '/register-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        password_confirm: passwordConfirm,
        character_name: characterName,
      }),
    });
  }

  /**
   * Logs in and returns session information.
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.username
   * @param {string} params.password
   * @returns {Promise<object>} Login response containing session_id
   */
  async function login({ mudApiBaseUrl, username, password }) {
    return apiCall(mudApiBaseUrl, '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  }

  /**
   * Logs out a session.
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.sessionId
   * @returns {Promise<object>} API response
   */
  async function logout({ mudApiBaseUrl, sessionId }) {
    return apiCall(mudApiBaseUrl, '/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  /**
   * Check whether a session is still valid.
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.sessionId
   * @returns {Promise<object>} API response
   */
  async function getStatus({ mudApiBaseUrl, sessionId }) {
    return apiCall(mudApiBaseUrl, `/status/${sessionId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Public API surface for other scripts.
  window.PipeWorksMudApi = {
    DEFAULTS,
    randomPassword,
    readSession,
    writeSession,
    clearSession,
    registerAccount,
    registerGuest,
    login,
    logout,
    getStatus,
  };
})();
