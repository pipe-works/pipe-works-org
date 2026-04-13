/*
 * namegen-api.js
 * Name generation API client.
 *
 * This file is deliberately tiny and readable. It exists both to power
 * the login flow and to show the simplest possible integration with the
 * name generator service.
 *
 * Responsibility:
 * - Call the name generator service to mint character names.
 * - Provide a slugify helper for MUD-safe usernames.
 *
 * Usage:
 *   const NameGen = window.PipeWorksNameGen;
 *   const rawName = await NameGen.generateName(NameGen.DEFAULTS.nameGenApiBaseUrl);
 *   const username = NameGen.slugifyName(rawName);
 */

(function () {
  'use strict';

  const DEFAULTS = {
    nameGenApiBaseUrl: 'https://name.api.pipe-works.org',
  };

  /**
   * Perform a JSON API request and return parsed data.
   *
   * @param {string} baseUrl - API base (e.g. https://name.api.pipe-works.org)
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
      const message = data?.error || data?.message || 'Request failed.';
      throw new Error(message);
    }
    return data;
  }

  /**
   * Make a MUD-friendly username (lowercase, underscore, length-limited).
   *
   * @param {string} raw
   * @returns {string}
   */
  function slugifyName(raw) {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 18);
  }

  /**
   * Ask the name generator for a single name.
   *
   * The payload here mirrors the current namegen service request format.
   * When allowFallback is true and the service is unreachable, we return
   * a simple goblin_scout_<num> token so the rest of the flow can continue.
   *
   * @param {string} nameGenApiBaseUrl
   * @param {object} [options]
   * @param {boolean} [options.allowFallback=true]
   * @returns {Promise<string>} Generated name
   */
  async function generateName(nameGenApiBaseUrl, options = {}) {
    const { allowFallback = true } = options;
    try {
      const payload = {
        class_key: 'first_name',
        package_id: 2,
        syllable_key: 'all',
        generation_count: 1,
        unique_only: true,
        output_format: 'json',
        render_style: 'title',
      };
      const response = await apiCall(nameGenApiBaseUrl, '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response?.names?.length) {
        return response.names[0];
      }
    } catch (err) {
      // ignored
    }
    if (!allowFallback) {
      throw new Error('Name generator unavailable.');
    }
    return `goblin_scout_${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * Ask the name generator for a first + last name pair.
   *
   * When allowFallback is true and the service is unreachable, we return
   * a simple goblin_scout_<num> token as both parts so the UI can continue.
   *
   * @param {string} nameGenApiBaseUrl
   * @param {object} [options]
   * @param {boolean} [options.allowFallback=true]
   * @returns {Promise<{first: string, last: string}>}
   */
  async function generateFullName(nameGenApiBaseUrl, options = {}) {
    const { allowFallback = true } = options;
    try {
      const [first, last] = await Promise.all([
        generateName(nameGenApiBaseUrl, { allowFallback: false }),
        generateName(nameGenApiBaseUrl, { allowFallback: false }),
      ]);
      return { first, last };
    } catch (err) {
      // ignored
    }
    if (!allowFallback) {
      throw new Error('Name generator unavailable.');
    }
    const fallback = `goblin_scout_${Math.floor(Math.random() * 10000)}`;
    return { first: fallback, last: fallback };
  }

  // Public API surface for other scripts.
  window.PipeWorksNameGen = {
    DEFAULTS,
    generateName,
    generateFullName,
    slugifyName,
  };
})();
