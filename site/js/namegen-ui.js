/*
 * namegen-ui.js
 * Minimal UI helper for the name generator.
 *
 * This is intentionally tiny: a single button + output line so
 * people can poke the goblin and see a name appear.
 */

(function () {
  'use strict';

  /**
   * Initialize a name generation panel.
   *
   * @param {object} options
   * @param {string} options.buttonId
   * @param {string} options.outputId
   * @param {string} [options.nameGenApiBaseUrl]
   */
  function initNameGenPanel(options) {
    const NameGen = window.PipeWorksNameGen;
    if (!NameGen) {
      return;
    }

    const config = {
      nameGenApiBaseUrl: NameGen.DEFAULTS.nameGenApiBaseUrl,
      ...options,
    };

    const button = document.getElementById(config.buttonId);
    const output = document.getElementById(config.outputId);

    if (!button || !output) {
      return;
    }

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      button.disabled = true;
      output.textContent = 'The goblin rummages for syllables...';
      try {
        const fullName = await NameGen.generateFullName(config.nameGenApiBaseUrl, {
          allowFallback: false,
        });
        output.textContent = `The goblin offers: ${fullName.first} ${fullName.last}`;
      } catch (err) {
        output.textContent = `Goblin says: ${err.message}`;
      } finally {
        button.disabled = false;
      }
    });
  }

  window.PipeWorksNameGenUI = {
    initNameGenPanel,
  };
})();
