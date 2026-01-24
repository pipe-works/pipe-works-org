/**
 * crooked-pipe.js
 * Interactive story game with full screen reader support
 */

(function () {
  'use strict';

  // Elements
  const nameInput = document.getElementById('name');
  const passwordInput = document.getElementById('password');
  const enterButton = document.getElementById('enter-button');
  const loginForm = document.getElementById('login-form');
  const gameStatus = document.getElementById('game-status');

  // Scene flow
  const scenes = [
    'scene-1',
    'scene-2',
    'scene-3',
    'scene-4',
    'scene-5',
    'scene-6',
    'scene-7',
    'scene-8',
  ];
  let currentScene = -1;

  /**
   * Announce a message to screen readers via the status element
   * @param {string} message - Text to announce
   */
  function announce(message) {
    if (gameStatus) {
      // Clear and re-set to ensure announcement triggers
      gameStatus.textContent = '';
      // Small delay ensures screen reader catches the change
      setTimeout(function () {
        gameStatus.textContent = message;
      }, 50);
    }
  }

  /**
   * Enable the Enter button when either input has content
   */
  function checkInputs() {
    const hasName = nameInput.value.trim().length > 0;
    const hasPassword = passwordInput.value.trim().length > 0;
    enterButton.disabled = !(hasName || hasPassword);
  }

  nameInput.addEventListener('input', checkInputs);
  passwordInput.addEventListener('input', checkInputs);

  /**
   * Show a scene by index
   * @param {number} index - Scene index (0-based)
   */
  function showScene(index) {
    // Hide all scenes first
    scenes.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('reveal-hidden');
        el.classList.remove('reveal-item');
      }
    });

    // Show the target scene
    if (index >= 0 && index < scenes.length) {
      const scene = document.getElementById(scenes[index]);
      if (scene) {
        scene.classList.remove('reveal-hidden');
        scene.classList.add('reveal-item');
        currentScene = index;

        // Move focus to the new scene for screen reader users
        // Delay slightly to allow CSS transition to complete
        setTimeout(function () {
          scene.focus();
        }, 100);

        // Find choice count for announcement
        const choices = scene.querySelectorAll('.choice');
        if (choices.length > 0) {
          announce(
            'Scene ' +
              (index + 1) +
              '. ' +
              choices.length +
              ' choice' +
              (choices.length > 1 ? 's' : '') +
              ' available. Use number keys or buttons to choose.'
          );
        }
      }
    }
  }

  /**
   * Advance to next scene
   */
  function nextScene() {
    if (currentScene < scenes.length - 1) {
      showScene(currentScene + 1);
    }
  }

  /**
   * Handle form submission - start the game
   */
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginForm.classList.add('form-hidden');

    // Announce game start
    announce('The story begins. You stand before a door.');

    // Small delay so announcement completes before first scene
    setTimeout(function () {
      showScene(0);
    }, 500);
  });

  /**
   * Handle choice button clicks - advance to next scene
   */
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('choice')) {
      const choiceText = e.target.textContent;
      announce('You chose: ' + choiceText);

      // Delay scene change slightly so choice announcement is heard
      setTimeout(function () {
        nextScene();
      }, 300);
    }
  });

  /**
   * Handle keyboard number keys for choices
   */
  document.addEventListener('keydown', function (e) {
    // Only respond to number keys 1-9 when game is active
    if (currentScene < 0) return;

    if (e.key >= '1' && e.key <= '9') {
      const currentSceneEl = document.getElementById(scenes[currentScene]);
      if (!currentSceneEl) return;

      // Find the choice with matching data-key
      const choice = currentSceneEl.querySelector('.choice[data-key="' + e.key + '"]');
      if (choice) {
        e.preventDefault();
        choice.click();
      }
    }
  });
})();
