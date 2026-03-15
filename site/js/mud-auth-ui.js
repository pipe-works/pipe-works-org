/*
 * mud-auth-ui.js
 * UI flow for character issue + login.
 *
 * This file is the "story layer": it turns API calls into a visible
 * three-stage ritual that people can follow and learn from.
 *
 * Responsibility:
 * - Orchestrate the three-stage story (generate -> issue -> login).
 * - Update UI copy for each stage.
 * - Render entity-state details returned by /register-guest.
 * - Use mud-api for actual calls.
 *
 * Usage:
 *   window.PipeWorksMudAuthUI.initLoginPanel({ ...element ids... });
 *   window.PipeWorksMudAuthUI.initStatusGate({ ...element ids... });
 */

(function () {
  'use strict';

  /**
   * Axis names currently treated as "occupation" conditions for snapshot payloads.
   *
   * The MUD snapshot API returns a flat ``axes`` object. Until policy group
   * metadata is exposed directly to this UI, we split known occupation axes by
   * name so the explore card can render character vs occupation columns.
   */
  const OCCUPATION_AXIS_NAMES = new Set([
    'legitimacy',
    'visibility',
    'moral_load',
    'dependency',
    'risk_exposure',
  ]);

  /**
   * Update a text element safely.
   *
   * @param {HTMLElement|null} element
   * @param {string} message
   */
  function setStatus(element, message) {
    if (element) {
      element.textContent = message;
    }
  }

  /**
   * Replace all child nodes in a list-like element.
   *
   * @param {HTMLElement|null} element
   */
  function clearChildren(element) {
    if (!element) {
      return;
    }
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Safely coerce a value into a plain object for axis rendering.
   *
   * @param {unknown} value
   * @returns {Record<string, unknown>}
   */
  function asPlainObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    return {};
  }

  /**
   * Format numeric axis scores for display with up to 3 decimal places.
   *
   * @param {unknown} score
   * @returns {string}
   */
  function formatAxisScore(score) {
    if (typeof score === 'number' && Number.isFinite(score)) {
      return String(Math.round(score * 1000) / 1000);
    }
    return String(score);
  }

  /**
   * Build a normalized snapshot payload for UI rendering and JSON export.
   *
   * @param {object} params
   * @param {string|null} params.accountUsername
   * @param {string|null} params.characterName
   * @param {number|null} params.characterId
   * @param {string|null} params.worldId
   * @param {object|null} params.entityState
   * @param {string|null} params.entityStateError
   * @returns {object|null}
   */
  function buildEntitySnapshot({
    accountUsername,
    characterName,
    characterId,
    worldId,
    entityState,
    entityStateError,
  }) {
    const hasState = Boolean(entityState && typeof entityState === 'object');
    const hasError = Boolean(entityStateError);
    const hasIdentity = Boolean(accountUsername || characterName || characterId || worldId);

    if (!hasState && !hasError && !hasIdentity) {
      return null;
    }

    return {
      account_username: accountUsername || null,
      character_name: characterName || null,
      character_id: characterId ?? null,
      world_id: worldId || null,
      entity_state: hasState ? entityState : null,
      entity_state_error: hasError ? entityStateError : null,
    };
  }

  /**
   * Resolve a character summary from login response payload.
   *
   * This is used as a fallback when /register-guest does not return
   * character_id/world_id yet.
   *
   * @param {object} loginResponse
   * @param {string|null} preferredCharacterName
   * @returns {object|null}
   */
  function resolveCharacterFromLogin(loginResponse, preferredCharacterName) {
    const candidates = Array.isArray(loginResponse?.characters) ? loginResponse.characters : [];
    if (!candidates.length) {
      return null;
    }

    const preferred = (preferredCharacterName || '').trim().toLowerCase();
    if (preferred) {
      const match = candidates.find((character) => {
        const name = String(character?.name || '')
          .trim()
          .toLowerCase();
        return name === preferred;
      });
      if (match) {
        return match;
      }
    }

    return candidates[0] || null;
  }

  /**
   * Enable/disable the entity JSON copy button.
   *
   * @param {HTMLButtonElement|null} button
   * @param {boolean} enabled
   */
  function setEntityCopyButtonState(button, enabled) {
    if (!button) {
      return;
    }
    button.disabled = !enabled;
  }

  /**
   * Append key/value axis rows to a UL element.
   *
   * The API returns dynamic axis names by world/policy. This renderer keeps
   * the UI generic by iterating the returned object rather than relying on a
   * fixed schema.
   *
   * @param {HTMLUListElement|null} listElement
   * @param {unknown} axes
   * @param {string} emptyMessage
   */
  function renderAxisList(listElement, axes, emptyMessage) {
    if (!listElement) {
      return;
    }

    clearChildren(listElement);
    const entries = Object.entries(asPlainObject(axes)).sort(([a], [b]) => a.localeCompare(b));

    if (!entries.length) {
      const emptyRow = document.createElement('li');
      emptyRow.className = 'permit-entity-empty';
      emptyRow.textContent = emptyMessage;
      listElement.appendChild(emptyRow);
      return;
    }

    entries.forEach(([axisName, axisValue]) => {
      const row = document.createElement('li');
      row.className = 'permit-entity-row';

      const label = document.createElement('span');
      label.className = 'permit-entity-axis';
      label.textContent = axisName;

      const value = document.createElement('span');
      value.className = 'permit-entity-value';
      value.textContent = String(axisValue);

      row.appendChild(label);
      row.appendChild(value);
      listElement.appendChild(row);
    });
  }

  /**
   * Convert snapshot-style axis objects into display strings.
   *
   * Expected shape example:
   * {
   *   "wealth": {"label": "well-kept", "score": 0.5}
   * }
   *
   * @param {unknown} axes
   * @returns {Record<string, string>}
   */
  function flattenSnapshotAxesForDisplay(axes) {
    const source = asPlainObject(axes);
    const result = {};

    Object.entries(source).forEach(([axisName, axisData]) => {
      const axisObject = asPlainObject(axisData);
      const label = axisObject.label;
      const score = axisObject.score;

      if (label !== undefined && score !== undefined) {
        result[axisName] = `${label} (${formatAxisScore(score)})`;
        return;
      }

      if (label !== undefined) {
        result[axisName] = String(label);
        return;
      }

      if (score !== undefined) {
        result[axisName] = formatAxisScore(score);
        return;
      }

      result[axisName] = String(axisData);
    });

    return result;
  }

  /**
   * Split flattened snapshot axes into character and occupation groups.
   *
   * @param {Record<string, string>} flattenedAxes
   * @param {Set<string>} [occupationAxisNames]
   * @returns {{characterAxes: Record<string, string>, occupationAxes: Record<string, string>}}
   */
  function splitFlattenedAxesByGroup(flattenedAxes, occupationAxisNames = OCCUPATION_AXIS_NAMES) {
    const characterAxes = {};
    const occupationAxes = {};

    Object.entries(asPlainObject(flattenedAxes)).forEach(([axisName, axisValue]) => {
      if (occupationAxisNames.has(axisName)) {
        occupationAxes[axisName] = String(axisValue);
        return;
      }
      characterAxes[axisName] = String(axisValue);
    });

    return { characterAxes, occupationAxes };
  }

  /**
   * Render the issued entity-state payload in the permit panel.
   *
   * @param {object} params
   * @param {HTMLElement|null} params.panelElement
   * @param {HTMLElement|null} params.seedElement
   * @param {HTMLElement|null} params.accountElement
   * @param {HTMLElement|null} params.characterElement
   * @param {HTMLElement|null} params.characterIdElement
   * @param {HTMLElement|null} params.worldElement
   * @param {HTMLUListElement|null} params.characterListElement
   * @param {HTMLUListElement|null} params.occupationListElement
   * @param {HTMLElement|null} params.errorElement
   * @param {Set<string>} params.occupationAxisNames
   * @param {object|null} params.entitySnapshot
   */
  function renderEntityStatePanel({
    panelElement,
    seedElement,
    accountElement,
    characterElement,
    characterIdElement,
    worldElement,
    characterListElement,
    occupationListElement,
    errorElement,
    occupationAxisNames,
    entitySnapshot,
  }) {
    if (!panelElement) {
      return;
    }

    if (!entitySnapshot) {
      panelElement.hidden = true;
      setStatus(seedElement, 'Seed: -');
      setStatus(accountElement, '-');
      setStatus(characterElement, '-');
      setStatus(characterIdElement, '-');
      setStatus(worldElement, '-');
      clearChildren(characterListElement);
      clearChildren(occupationListElement);
      if (errorElement) {
        errorElement.hidden = true;
        errorElement.textContent = '';
      }
      return;
    }

    panelElement.hidden = false;

    const accountUsername = entitySnapshot.account_username || '-';
    const characterName = entitySnapshot.character_name || '-';
    const characterId = entitySnapshot.character_id ?? '-';
    const worldId = entitySnapshot.world_id || '-';

    setStatus(accountElement, String(accountUsername));
    setStatus(characterElement, String(characterName));
    setStatus(characterIdElement, String(characterId));
    setStatus(worldElement, String(worldId));

    const entityState = entitySnapshot.entity_state;
    const entityStateError = entitySnapshot.entity_state_error;
    const hasState = Boolean(entityState && typeof entityState === 'object');
    const hasError = Boolean(entityStateError);

    if (hasState) {
      const safeState = asPlainObject(entityState);

      // Shape A: entity service payload -> {seed, character, occupation}
      if (safeState.character || safeState.occupation) {
        const seed = safeState.seed;
        setStatus(seedElement, `Seed: ${seed ?? '-'}`);
        renderAxisList(
          characterListElement,
          safeState.character,
          'No character-axis values were returned.'
        );
        renderAxisList(
          occupationListElement,
          safeState.occupation,
          'No occupation-axis values were returned.'
        );
      }
      // Shape B: mud snapshot payload -> {seed, world_id, axes: {...}}
      else if (safeState.axes) {
        const seed = safeState.seed;
        setStatus(seedElement, `Seed: ${seed ?? '-'}`);
        const flattenedAxes = flattenSnapshotAxesForDisplay(safeState.axes);
        const groupedAxes = splitFlattenedAxesByGroup(flattenedAxes, occupationAxisNames);
        renderAxisList(
          characterListElement,
          groupedAxes.characterAxes,
          'No character-axis values were returned.'
        );
        renderAxisList(
          occupationListElement,
          groupedAxes.occupationAxes,
          'No occupation-axis values were returned.'
        );
      } else {
        setStatus(seedElement, 'Seed: unavailable');
        renderAxisList(characterListElement, null, 'No character-axis values were returned.');
        renderAxisList(occupationListElement, null, 'No occupation-axis values were returned.');
      }
    } else {
      setStatus(seedElement, 'Seed: unavailable');
      renderAxisList(characterListElement, null, 'No character-axis values were returned.');
      renderAxisList(occupationListElement, null, 'No occupation-axis values were returned.');
    }

    if (errorElement) {
      if (hasError) {
        errorElement.hidden = false;
        errorElement.textContent = `Entity state note: ${entityStateError}`;
      } else {
        errorElement.hidden = true;
        errorElement.textContent = '';
      }
    }
  }

  /**
   * Render the entity profile snapshot directly onto a canvas and trigger
   * a PNG download.
   *
   * This draws text and lines manually to avoid the tainted-canvas
   * restriction that blocks SVG foreignObject → canvas export.
   *
   * @param {object} snapshot - The entity snapshot object.
   * @param {string} filename - Download filename (without extension).
   * @param {Set<string>} occupationNames - Axis names in the occupation group.
   */
  function renderEntityCardAsPng(snapshot, filename, occupationNames) {
    var scale = 2;
    var cardWidth = 560;
    var pad = 28;
    var contentWidth = cardWidth - pad * 2;
    var ink = '#322619';
    var inkFaded = 'rgba(50, 38, 25, 0.55)';
    var paper = '#f8efdc';
    var rule = 'rgba(50, 38, 25, 0.25)';
    var mono = '"Courier New", Courier, monospace';
    var sans = 'Georgia, "Times New Roman", serif';

    // Collect data from snapshot.
    var account = snapshot.account_username || '-';
    var character = snapshot.character_name || '-';
    var characterId = snapshot.character_id != null ? String(snapshot.character_id) : '-';
    var worldId = snapshot.world_id || '-';
    var entityState = snapshot.entity_state;
    var seed = '-';
    var charAxes = {};
    var occAxes = {};

    if (entityState && typeof entityState === 'object') {
      if (entityState.seed != null) {
        seed = String(entityState.seed);
      }
      // Shape A: {character, occupation}
      if (entityState.character || entityState.occupation) {
        charAxes = asPlainObject(entityState.character);
        occAxes = asPlainObject(entityState.occupation);
      }
      // Shape B: {axes: {...}}
      else if (entityState.axes) {
        var flat = flattenSnapshotAxesForDisplay(entityState.axes);
        var split = splitFlattenedAxesByGroup(flat, occupationNames);
        charAxes = split.characterAxes;
        occAxes = split.occupationAxes;
      }
    }

    var charEntries = Object.entries(asPlainObject(charAxes)).sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });
    var occEntries = Object.entries(asPlainObject(occAxes)).sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });

    // Calculate card height based on content.
    var headerHeight = 90;
    var idCardHeight = 120;
    var axisHeaderHeight = 40;
    var axisRowHeight = 22;
    var maxRows = Math.max(charEntries.length, occEntries.length, 1);
    var axisBlockHeight = axisHeaderHeight + maxRows * axisRowHeight + 16;
    var cardHeight = headerHeight + idCardHeight + axisBlockHeight + pad * 2 + 20;

    var canvas = document.createElement('canvas');
    canvas.width = cardWidth * scale;
    canvas.height = cardHeight * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Paper background.
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Dashed border.
    ctx.strokeStyle = 'rgba(50, 38, 25, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(8, 8, cardWidth - 16, cardHeight - 16);
    ctx.setLineDash([]);

    var x = pad;
    var y = pad;

    // Title.
    ctx.fillStyle = ink;
    ctx.font = 'bold 14px ' + sans;
    ctx.textBaseline = 'top';
    ctx.fillText('ISSUED ENTITY PROFILE', x, y);
    y += 26;

    // Seed.
    ctx.fillStyle = inkFaded;
    ctx.font = '11px ' + mono;
    ctx.fillText('Seed: ' + seed, x, y);
    y += 30;

    // ID card box.
    var idBoxX = x;
    var idBoxY = y;
    var idBoxW = contentWidth;
    var idBoxH = idCardHeight;
    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    ctx.strokeRect(idBoxX, idBoxY, idBoxW, idBoxH);
    ctx.fillStyle = 'rgba(248, 239, 220, 0.35)';
    ctx.fillRect(idBoxX, idBoxY, idBoxW, idBoxH);

    // Portrait placeholder.
    var portraitW = 90;
    var portraitH = idBoxH - 16;
    var portraitX = idBoxX + 8;
    var portraitY = idBoxY + 8;
    ctx.strokeStyle = rule;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(portraitX, portraitY, portraitW, portraitH);
    ctx.setLineDash([]);
    ctx.fillStyle = inkFaded;
    ctx.font = '9px ' + mono;
    ctx.textAlign = 'center';
    ctx.fillText('PORTRAIT', portraitX + portraitW / 2, portraitY + portraitH / 2 - 6);
    ctx.fillText('PLACEHOLDER', portraitX + portraitW / 2, portraitY + portraitH / 2 + 6);
    ctx.textAlign = 'left';

    // Meta fields.
    var metaX = portraitX + portraitW + 16;
    var metaY = idBoxY + 16;
    var metaLabelW = 90;
    var metaFields = [
      ['ACCOUNT', account],
      ['CHARACTER', character],
      ['CHARACTER ID', characterId],
      ['WORLD', worldId],
    ];
    ctx.textBaseline = 'top';
    metaFields.forEach(function (pair) {
      ctx.fillStyle = inkFaded;
      ctx.font = '9px ' + sans;
      ctx.fillText(pair[0], metaX, metaY);
      ctx.fillStyle = ink;
      ctx.font = '12px ' + mono;
      ctx.fillText(pair[1], metaX + metaLabelW, metaY - 1);
      // Dotted rule.
      ctx.strokeStyle = rule;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(metaX, metaY + 16);
      ctx.lineTo(idBoxX + idBoxW - 8, metaY + 16);
      ctx.stroke();
      ctx.setLineDash([]);
      metaY += 24;
    });

    y = idBoxY + idBoxH + 16;

    // Axis conditions header.
    ctx.strokeStyle = rule;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + contentWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 10;

    ctx.fillStyle = ink;
    ctx.font = 'bold 11px ' + sans;
    ctx.fillText('AXIS CONDITIONS', x, y);
    y += 22;

    // Two-column axis layout.
    var colW = contentWidth / 2 - 8;
    var leftX = x;
    var rightX = x + contentWidth / 2 + 8;

    // Column headers.
    ctx.fillStyle = inkFaded;
    ctx.font = 'bold 10px ' + sans;
    ctx.fillText('CHARACTER AXES', leftX, y);
    ctx.fillText('OCCUPATION AXES', rightX, y);
    y += 18;

    var startY = y;

    function drawAxisColumn(entries, colX, colWidth, startAtY) {
      var rowY = startAtY;
      if (!entries.length) {
        ctx.fillStyle = inkFaded;
        ctx.font = 'italic 10px ' + sans;
        ctx.fillText('No values returned.', colX, rowY);
        return;
      }
      entries.forEach(function (pair) {
        var name = pair[0].replace(/_/g, '_');
        var displayName = name.charAt(0).toUpperCase() + name.slice(1);
        var val = String(pair[1]);
        ctx.fillStyle = inkFaded;
        ctx.font = '10px ' + mono;
        ctx.fillText(displayName, colX, rowY);
        ctx.fillStyle = ink;
        ctx.font = 'bold 10px ' + mono;
        ctx.textAlign = 'right';
        ctx.fillText(val, colX + colWidth, rowY);
        ctx.textAlign = 'left';
        // Row rule.
        ctx.strokeStyle = rule;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(colX, rowY + 12);
        ctx.lineTo(colX + colWidth, rowY + 12);
        ctx.stroke();
        ctx.setLineDash([]);
        rowY += axisRowHeight;
      });
    }

    drawAxisColumn(charEntries, leftX, colW, startY);
    drawAxisColumn(occEntries, rightX, colW, startY);

    // Export as PNG download.
    canvas.toBlob(function (blob) {
      if (!blob) {
        return;
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  }

  /**
   * Runs the full flow:
   * 1) Generate or accept account/character names
   * 2) Issue a password
   * 3) Register and login
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.sessionStorageKey
   * @param {string} params.nameGenApiBaseUrl
   * @param {HTMLInputElement|null} params.accountInput
   * @param {HTMLInputElement} params.usernameInput
   * @param {HTMLInputElement} params.passwordInput
   * @param {HTMLElement} params.statusElement
   * @param {HTMLElement|null} params.stageGenerate
   * @param {HTMLElement|null} params.stagePassword
   * @param {HTMLElement|null} params.stageLogin
   * @returns {Promise<object>} Login response + optional entity-state metadata
   */
  async function registerAndLogin({
    mudApiBaseUrl,
    sessionStorageKey,
    nameGenApiBaseUrl,
    accountInput,
    usernameInput,
    passwordInput,
    statusElement,
    stageGenerate,
    stagePassword,
    stageLogin,
  }) {
    // Pull dependencies from globals. This keeps API boundaries visible.
    const MudApi = window.PipeWorksMudApi;
    const NameGen = window.PipeWorksNameGen;
    if (!MudApi || !NameGen) {
      throw new Error('Missing API helpers.');
    }

    let issuedEntityState = null;
    let issuedEntityStateError = null;
    let issuedCharacterId = null;
    let issuedWorldId = null;

    // Stage 2: issue or reuse password.
    // The server enforces a strong password policy, so we default to a
    // generated password if the user leaves this blank.
    const password = passwordInput.value || MudApi.randomPassword();
    passwordInput.value = password;
    if (stagePassword) {
      stagePassword.textContent = `Stage 2: Password issued. Copy it now: ${password}`;
    }

    // Stage 1: gather names and register the guest account.
    // If the account username is blank, we use /register-guest, which
    // generates the account username server-side.
    let characterName = usernameInput.value.trim();
    let accountUsername = accountInput?.value?.trim() || '';

    statusElement.textContent = 'Issuing character...';
    if (!accountUsername) {
      if (!characterName && stageGenerate) {
        stageGenerate.textContent =
          'Stage 1: Creating a guest name. The server will mint the account.';
      }

      // Server-generated guest account. The server requires a password and
      // a character name even when it generates the account username.
      if (!characterName) {
        const generated = await NameGen.generateFullName(nameGenApiBaseUrl, {
          allowFallback: true,
        });
        characterName = `${generated.first} ${generated.last}`;
        usernameInput.value = characterName;
      }

      const guestResponse = await MudApi.registerGuest({
        mudApiBaseUrl,
        password,
        passwordConfirm: password,
        characterName,
      });

      accountUsername = guestResponse?.username || '';
      issuedEntityState = guestResponse?.entity_state || null;
      issuedEntityStateError = guestResponse?.entity_state_error || null;
      issuedCharacterId = guestResponse?.character_id ?? null;
      issuedWorldId = guestResponse?.world_id ?? null;

      if (accountInput && accountUsername) {
        accountInput.value = accountUsername;
      }

      if (stageGenerate) {
        const baseMessage = `Stage 1: Generated ${characterName}. A fresh name joins the ledger.`;
        stageGenerate.textContent = issuedEntityState
          ? `${baseMessage} Entity profile stamped.`
          : baseMessage;
      }
    } else {
      // Client-supplied username via /register.
      // Note: the current API only accepts a username; character naming is
      // still coupled to account creation until server supports separate fields.
      if (!accountUsername && characterName) {
        accountUsername = characterName;
        if (accountInput) {
          accountInput.value = accountUsername;
        }
      }
      await MudApi.registerAccount({ mudApiBaseUrl, username: accountUsername, password });
      if (stageGenerate) {
        const label = characterName || accountUsername;
        stageGenerate.textContent = `Stage 1: Using ${label}. You brought your own name.`;
      }
    }

    // Stage 3: login with the issued credentials.
    statusElement.textContent = 'Logging in...';
    if (stageLogin) {
      stageLogin.textContent = 'Stage 3: Presenting name + password to the MUD...';
    }
    const loginResponse = await MudApi.login({
      mudApiBaseUrl,
      username: accountUsername,
      password,
    });

    if (!loginResponse?.session_id) {
      throw new Error('Login succeeded but no session_id returned.');
    }

    // Backfill character metadata from login response if registration did not
    // include these fields yet.
    if (issuedCharacterId == null || !issuedWorldId) {
      const loginCharacter = resolveCharacterFromLogin(loginResponse, characterName);
      if (loginCharacter) {
        if (issuedCharacterId == null && loginCharacter.id != null) {
          const parsedId = Number(loginCharacter.id);
          if (Number.isFinite(parsedId)) {
            issuedCharacterId = parsedId;
          }
        }
        if (!issuedWorldId && loginCharacter.world_id) {
          issuedWorldId = String(loginCharacter.world_id);
        }
      }
    }

    // Persist session for subsequent MUD pages.
    MudApi.writeSession(
      {
        session_id: loginResponse.session_id,
        username: characterName || accountUsername,
        account_username: accountUsername || characterName,
        role: loginResponse.role || null,
        logged_in_at: new Date().toISOString(),
        character_id: issuedCharacterId,
        character_name: characterName || null,
        world_id: issuedWorldId,
        entity_state: issuedEntityState,
        entity_state_error: issuedEntityStateError,
      },
      { sessionStorageKey }
    );

    if (stageLogin) {
      stageLogin.textContent = 'Stage 3: Login confirmed. The door clicks open.';
    }

    return {
      ...loginResponse,
      account_username: accountUsername || null,
      character_id: issuedCharacterId,
      character_name: characterName || null,
      world_id: issuedWorldId,
      entity_state: issuedEntityState,
      entity_state_error: issuedEntityStateError,
    };
  }

  /**
   * Logs out and clears any stored session.
   *
   * @param {object} params
   * @param {string} params.mudApiBaseUrl
   * @param {string} params.sessionStorageKey
   * @param {HTMLElement} params.statusElement
   * @returns {Promise<void>}
   */
  async function logout({ mudApiBaseUrl, sessionStorageKey, statusElement }) {
    const MudApi = window.PipeWorksMudApi;
    if (!MudApi) {
      throw new Error('Missing MUD API helpers.');
    }

    const session = MudApi.readSession({ sessionStorageKey });
    if (!session?.session_id) {
      MudApi.clearSession({ sessionStorageKey });
      return;
    }
    statusElement.textContent = 'Logging out...';
    await MudApi.logout({ mudApiBaseUrl, sessionId: session.session_id });
    MudApi.clearSession({ sessionStorageKey });
  }

  /**
   * Wire up the login panel on explore pages.
   * Expects ids for inputs, buttons, status, and optional stage text.
   *
   * @param {object} options
   * @param {string} options.usernameInputId
   * @param {string} [options.accountInputId]
   * @param {string} options.passwordInputId
   * @param {string} options.statusElementId
   * @param {string} options.loginButtonId
   * @param {string} [options.copyButtonId]
   * @param {string} options.logoutButtonId
   * @param {string} [options.stageGenerateId]
   * @param {string} [options.stagePasswordId]
   * @param {string} [options.stageLoginId]
   * @param {string} [options.entityPanelId]
   * @param {string} [options.entitySeedId]
   * @param {string} [options.entityAccountId]
   * @param {string} [options.entityCharacterNameId]
   * @param {string} [options.entityCharacterIdId]
   * @param {string} [options.entityWorldId]
   * @param {string} [options.entityCharacterListId]
   * @param {string} [options.entityOccupationListId]
   * @param {string} [options.entityErrorId]
   * @param {string} [options.entityCopyButtonId]
   * @param {string} [options.entitySavePngButtonId]
   * @param {string[]} [options.occupationAxisNames]
   * @param {string} [options.mudApiBaseUrl]
   * @param {string} [options.nameGenApiBaseUrl]
   * @param {string} [options.sessionStorageKey]
   */
  function initLoginPanel(options) {
    // Ensure dependencies are present.
    const MudApi = window.PipeWorksMudApi;
    const NameGen = window.PipeWorksNameGen;
    if (!MudApi || !NameGen) {
      return;
    }

    const config = {
      mudApiBaseUrl: MudApi.DEFAULTS.mudApiBaseUrl,
      nameGenApiBaseUrl: NameGen.DEFAULTS.nameGenApiBaseUrl,
      sessionStorageKey: MudApi.DEFAULTS.sessionStorageKey,
      ...options,
    };

    const usernameInput = document.getElementById(config.usernameInputId);
    const accountInput = config.accountInputId
      ? document.getElementById(config.accountInputId)
      : null;
    const passwordInput = document.getElementById(config.passwordInputId);
    const statusElement = document.getElementById(config.statusElementId);
    const loginButton = document.getElementById(config.loginButtonId);
    const copyButton = config.copyButtonId ? document.getElementById(config.copyButtonId) : null;
    const logoutButton = document.getElementById(config.logoutButtonId);
    const stageGenerate = config.stageGenerateId
      ? document.getElementById(config.stageGenerateId)
      : null;
    const stagePassword = config.stagePasswordId
      ? document.getElementById(config.stagePasswordId)
      : null;
    const stageLogin = config.stageLoginId ? document.getElementById(config.stageLoginId) : null;

    const entityPanelElement = config.entityPanelId
      ? document.getElementById(config.entityPanelId)
      : null;
    const entitySeedElement = config.entitySeedId
      ? document.getElementById(config.entitySeedId)
      : null;
    const entityAccountElement = config.entityAccountId
      ? document.getElementById(config.entityAccountId)
      : null;
    const entityCharacterElement = config.entityCharacterNameId
      ? document.getElementById(config.entityCharacterNameId)
      : null;
    const entityCharacterIdElement = config.entityCharacterIdId
      ? document.getElementById(config.entityCharacterIdId)
      : null;
    const entityWorldElement = config.entityWorldId
      ? document.getElementById(config.entityWorldId)
      : null;
    const entityCharacterListElement = config.entityCharacterListId
      ? document.getElementById(config.entityCharacterListId)
      : null;
    const entityOccupationListElement = config.entityOccupationListId
      ? document.getElementById(config.entityOccupationListId)
      : null;
    const entityErrorElement = config.entityErrorId
      ? document.getElementById(config.entityErrorId)
      : null;
    const entityCopyButton = config.entityCopyButtonId
      ? document.getElementById(config.entityCopyButtonId)
      : null;
    const entitySavePngButton = config.entitySavePngButtonId
      ? document.getElementById(config.entitySavePngButtonId)
      : null;

    const occupationAxisNames = new Set(
      Array.isArray(config.occupationAxisNames) && config.occupationAxisNames.length
        ? config.occupationAxisNames
        : Array.from(OCCUPATION_AXIS_NAMES)
    );

    if (!usernameInput || !passwordInput || !statusElement || !loginButton || !logoutButton) {
      return;
    }

    let currentEntitySnapshot = null;
    setEntityCopyButtonState(entityCopyButton, false);
    setEntityCopyButtonState(entitySavePngButton, false);

    /**
     * Render and cache current entity snapshot in one place.
     *
     * @param {object|null} snapshot
     */
    function applyEntitySnapshot(snapshot) {
      currentEntitySnapshot = snapshot;
      renderEntityStatePanel({
        panelElement: entityPanelElement,
        seedElement: entitySeedElement,
        accountElement: entityAccountElement,
        characterElement: entityCharacterElement,
        characterIdElement: entityCharacterIdElement,
        worldElement: entityWorldElement,
        characterListElement: entityCharacterListElement,
        occupationListElement: entityOccupationListElement,
        errorElement: entityErrorElement,
        occupationAxisNames,
        entitySnapshot: currentEntitySnapshot,
      });
      setEntityCopyButtonState(entityCopyButton, Boolean(currentEntitySnapshot));
      setEntityCopyButtonState(entitySavePngButton, Boolean(currentEntitySnapshot));
    }

    // Copy credentials helper.
    // This intentionally copies the three fields in a clear, single block.
    if (copyButton) {
      copyButton.addEventListener('click', async (event) => {
        event.preventDefault();
        const characterName = usernameInput.value.trim();
        const accountUsername = accountInput?.value?.trim() || '';
        const password = passwordInput.value;
        if (!characterName || !accountUsername || !password) {
          setStatus(statusElement, 'Need character, account, and password to copy.');
          return;
        }
        const payload = [
          `Character: ${characterName}`,
          `Account: ${accountUsername}`,
          `Password: ${password}`,
        ].join('\n');
        try {
          await navigator.clipboard.writeText(payload);
          setStatus(statusElement, 'Credentials copied to clipboard.');
        } catch (_err) {
          setStatus(statusElement, 'Clipboard unavailable. Copy manually.');
        }
      });
    }

    // Copy entity snapshot helper for debugging or support transcripts.
    if (entityCopyButton) {
      entityCopyButton.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!currentEntitySnapshot) {
          setStatus(statusElement, 'No entity profile is available to copy yet.');
          return;
        }
        try {
          const payload = JSON.stringify(currentEntitySnapshot, null, 2);
          await navigator.clipboard.writeText(payload);
          setStatus(statusElement, 'Entity profile JSON copied to clipboard.');
        } catch (_err) {
          setStatus(statusElement, 'Clipboard unavailable. Copy profile manually.');
        }
      });
    }

    // Save entity profile panel as a PNG image.
    if (entitySavePngButton) {
      entitySavePngButton.addEventListener('click', function (event) {
        event.preventDefault();
        if (!currentEntitySnapshot) {
          setStatus(statusElement, 'No entity profile is available to save yet.');
          return;
        }
        var characterName = (currentEntitySnapshot.character_name || 'entity')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .toLowerCase();
        try {
          renderEntityCardAsPng(
            currentEntitySnapshot,
            'permit_' + characterName,
            occupationAxisNames
          );
          setStatus(statusElement, 'Permit card saved as PNG.');
        } catch (_err) {
          setStatus(statusElement, 'PNG export failed. Try a screenshot instead.');
        }
      });
    }

    // If a session already exists, validate it before showing logged-in state.
    const existingSession = MudApi.readSession({ sessionStorageKey: config.sessionStorageKey });
    if (existingSession?.session_id && existingSession?.username) {
      setStatus(statusElement, 'Checking existing session...');
      MudApi.getStatus({
        mudApiBaseUrl: config.mudApiBaseUrl,
        sessionId: existingSession.session_id,
      })
        .then((statusResponse) => {
          if (!statusResponse?.session_id) {
            throw new Error('Session invalid.');
          }
          setStatus(statusElement, `Logged in as ${existingSession.username}.`);
          if (stageGenerate) {
            stageGenerate.textContent = `Stage 1: ${existingSession.username} already holds a name.`;
          }
          if (stagePassword) {
            stagePassword.textContent = 'Stage 2: Password already issued for this session.';
          }
          if (stageLogin) {
            stageLogin.textContent = 'Stage 3: Session is active.';
          }

          applyEntitySnapshot(
            buildEntitySnapshot({
              accountUsername: existingSession.account_username || null,
              characterName: existingSession.character_name || existingSession.username || null,
              characterId: existingSession.character_id ?? null,
              worldId: existingSession.world_id || null,
              entityState: existingSession.entity_state || null,
              entityStateError: existingSession.entity_state_error || null,
            })
          );

          logoutButton.hidden = false;
          loginButton.hidden = true;
        })
        .catch(() => {
          MudApi.clearSession({ sessionStorageKey: config.sessionStorageKey });
          setStatus(statusElement, 'Session expired. Ready to issue a visitor account.');
          applyEntitySnapshot(null);
        });
    }

    // Handle the stage-driven login flow.
    loginButton.addEventListener('click', async (event) => {
      event.preventDefault();
      loginButton.disabled = true;
      setStatus(statusElement, 'Issuing a guest account...');
      try {
        const loginResponse = await registerAndLogin({
          mudApiBaseUrl: config.mudApiBaseUrl,
          sessionStorageKey: config.sessionStorageKey,
          nameGenApiBaseUrl: config.nameGenApiBaseUrl,
          accountInput,
          usernameInput,
          passwordInput,
          statusElement,
          stageGenerate,
          stagePassword,
          stageLogin,
        });

        setStatus(statusElement, `Logged in as ${usernameInput.value}. Session confirmed.`);

        applyEntitySnapshot(
          buildEntitySnapshot({
            accountUsername: loginResponse.account_username || accountInput?.value?.trim() || null,
            characterName: loginResponse.character_name || usernameInput.value.trim() || null,
            characterId: loginResponse.character_id ?? null,
            worldId: loginResponse.world_id || null,
            entityState: loginResponse.entity_state || null,
            entityStateError: loginResponse.entity_state_error || null,
          })
        );

        logoutButton.hidden = false;
        loginButton.hidden = true;
      } catch (err) {
        setStatus(statusElement, `Goblin says: ${err.message}`);
      } finally {
        loginButton.disabled = false;
      }
    });

    // Handle logout and reset stage prompts.
    logoutButton.addEventListener('click', async (event) => {
      event.preventDefault();
      logoutButton.disabled = true;
      try {
        await logout({
          mudApiBaseUrl: config.mudApiBaseUrl,
          sessionStorageKey: config.sessionStorageKey,
          statusElement,
        });
        setStatus(statusElement, 'Logged out. The logbook is closed.');
        if (stageGenerate) {
          stageGenerate.textContent = 'Stage 1: Waiting for a name.';
        }
        if (stagePassword) {
          stagePassword.textContent = 'Stage 2: Waiting for a password.';
        }
        if (stageLogin) {
          stageLogin.textContent = 'Stage 3: Waiting for a login.';
        }

        applyEntitySnapshot(null);

        usernameInput.value = '';
        if (accountInput) {
          accountInput.value = '';
        }
        passwordInput.value = '';
        loginButton.hidden = false;
        logoutButton.hidden = true;
      } catch (err) {
        setStatus(statusElement, `Goblin says: ${err.message}`);
      } finally {
        logoutButton.disabled = false;
      }
    });
  }

  /**
   * Gating helper for MUD pages.
   * Shows or hides action blocks depending on session presence.
   *
   * @param {object} options
   * @param {string} options.statusElementId
   * @param {string} options.actionsElementId
   * @param {string} [options.sessionStorageKey]
   */
  function initStatusGate(options) {
    const MudApi = window.PipeWorksMudApi;
    if (!MudApi) {
      return;
    }
    const config = {
      sessionStorageKey: MudApi.DEFAULTS.sessionStorageKey,
      ...options,
    };
    const statusElement = document.getElementById(config.statusElementId);
    const actionsElement = document.getElementById(config.actionsElementId);
    const session = MudApi.readSession({ sessionStorageKey: config.sessionStorageKey });
    if (session?.session_id && session?.username) {
      setStatus(statusElement, `Logged in as ${session.username}.`);
      if (actionsElement) {
        actionsElement.hidden = false;
      }
      return;
    }
    setStatus(statusElement, 'No active session. Return to explore and log in.');
    if (actionsElement) {
      actionsElement.hidden = true;
    }
  }

  // Public API surface for other scripts.
  window.PipeWorksMudAuthUI = {
    initLoginPanel,
    initStatusGate,
  };
})();
