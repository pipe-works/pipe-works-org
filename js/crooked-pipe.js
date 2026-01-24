// Elements
const nameInput = document.getElementById('name');
const passwordInput = document.getElementById('password');
const enterButton = document.getElementById('enter-button');
const loginForm = document.getElementById('login-form');

// Scene flow
const scenes = [
  'scene-1', 'scene-2', 'scene-3', 'scene-4',
  'scene-5', 'scene-6', 'scene-7', 'scene-8'
];
let currentScene = -1;

// Enable the Enter button when either input has content
function checkInputs() {
  const hasName = nameInput.value.trim().length > 0;
  const hasPassword = passwordInput.value.trim().length > 0;
  enterButton.disabled = !(hasName || hasPassword);
}

nameInput.addEventListener('input', checkInputs);
passwordInput.addEventListener('input', checkInputs);

// Show a scene by index
function showScene(index) {
  // Hide all scenes first
  scenes.forEach(id => {
    const el = document.getElementById(id);
    el.classList.add('reveal-hidden');
    el.classList.remove('reveal-item');
  });

  // Show the target scene
  if (index >= 0 && index < scenes.length) {
    const scene = document.getElementById(scenes[index]);
    scene.classList.remove('reveal-hidden');
    scene.classList.add('reveal-item');
    currentScene = index;
  }
}

// Advance to next scene
function nextScene() {
  showScene(currentScene + 1);
}

// Handle form submission - start the game
loginForm.addEventListener('submit', function(e) {
  e.preventDefault();
  loginForm.style.display = 'none';
  showScene(0);
});

// Handle choice button clicks - advance to next scene
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('choice')) {
    nextScene();
  }
});
