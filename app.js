const dataUrl = '联合小组 2 - Full Name List (updated).json';
const gameEventDataUrl = 'game_event_groups.json';
const adminPassword = '7212';

const leaderNormalization = {
  alan: 'Ps Alan',
  huiyee: 'Hui Yee',
  祥辉: 'Siang Fei',
  丽环: 'Lee Hwan',
};

const genderGroupNormalization = {
  'young adult / teen': 'Young Adult',
};

const gameGroupChineseNames = {
  Love: '仁爱',
  Joy: '喜乐',
  Peace: '平安',
  Patience: '忍耐',
  Kindness: '恩慈',
  Goodness: '良善',
  Faithfulness: '信实',
  Gentleness: '温柔',
  'Self-Control': '节制',
};

const state = {
  entries: [],
  gameEventGroups: [],
  gameEventParticipants: [],
  activeTab: 'game',
  rawJsonView: 'roster',
  adminUnlocked: false,
  adminGroupId: '',
  adminLeaderNumber: '',
  gameEventBackup: null,
  search: '',
  gender: 'All',
  leader: 'All',
  gameLeaderSearch: 'All',
  gameNameSearch: '',
};

const els = {};

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function searchKey(value) {
  return normalize(value).replace(/[\s'\-.]/g, '');
}

function canonicalize(value, normalizationMap) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  return normalizationMap[trimmed.toLowerCase()] ?? trimmed;
}

function formatName(primary, secondary) {
  return [primary, secondary].filter(Boolean).join(' / ');
}

function formatGameGroupName(groupName) {
  const trimmedName = String(groupName ?? '').trim();
  if (!trimmedName) {
    return '';
  }

  const chineseName = gameGroupChineseNames[trimmedName];
  return chineseName ? `${trimmedName} ${chineseName}` : trimmedName;
}

function cloneGameEventData(groups, participants) {
  return {
    groups: groups.map((group) => ({ ...group })),
    participants: participants.map((participant) => ({ ...participant })),
  };
}

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

function normalizeRosterEntry(entry) {
  return {
    ...entry,
    small_group_leader: canonicalize(entry.small_group_leader, leaderNormalization),
    gender_group: canonicalize(entry.gender_group, genderGroupNormalization),
  };
}

function getGroupById(groupId) {
  return state.gameEventGroups.find((group) => Number(group.id) === Number(groupId));
}

function getGroupParticipants(groupId) {
  return state.gameEventParticipants.filter((participant) => Number(participant.game_event_group_id) === Number(groupId));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matches(entry) {
  const haystack = [
    entry.number,
    entry.name_chinese,
    entry.name_english,
    entry.small_group_leader,
    entry.gender_group,
  ]
    .map(searchKey)
    .join(' ');

  const searchOk = !state.search || haystack.includes(searchKey(state.search));
  const genderOk = state.gender === 'All' || searchKey(entry.gender_group) === searchKey(state.gender);
  const leaderOk = state.leader === 'All' || searchKey(entry.small_group_leader) === searchKey(state.leader);

  return searchOk && genderOk && leaderOk;
}

function renderFilters() {
  const genders = ['All', ...unique(state.entries.map((entry) => entry.gender_group))];
  const leaders = ['All', ...unique(state.entries.map((entry) => entry.small_group_leader))];

  els.genderFilter.innerHTML = genders.map((value) => `<option value="${value}">${value}</option>`).join('');
  els.leaderFilter.innerHTML = leaders.map((value) => `<option value="${value}">${value}</option>`).join('');

  els.genderFilter.value = state.gender;
  els.leaderFilter.value = state.leader;
}

function renderGameLeaderFilter() {
  const leaders = ['All', ...unique(state.gameEventParticipants.map((entry) => entry.small_group_leader))];
  els.gameLeaderSearch.innerHTML = leaders.map((value) => `<option value="${value}">${value}</option>`).join('');
  els.gameLeaderSearch.value = state.gameLeaderSearch || 'All';
}

function renderAdminControls() {
  const groups = state.gameEventGroups.slice().sort((left, right) => Number(left.id) - Number(right.id));
  if (!groups.length) {
    return;
  }

  if (!state.adminGroupId || !groups.some((group) => String(group.id) === String(state.adminGroupId))) {
    state.adminGroupId = String(groups[0].id);
  }

  els.adminGroupSelect.innerHTML = groups
    .map((group) => `<option value="${group.id}">${group.id}. ${group.name}</option>`)
    .join('');
  els.adminGroupSelect.value = String(state.adminGroupId);

  const selectedGroup = getGroupById(state.adminGroupId);
  const selectedParticipants = getGroupParticipants(state.adminGroupId);

  if (!selectedParticipants.length) {
    els.adminLeaderSelect.innerHTML = '';
    return;
  }

  const fallbackLeaderNumber = selectedGroup?.leader_number ? String(selectedGroup.leader_number) : String(selectedParticipants[0].number);

  if (!state.adminLeaderNumber || !selectedParticipants.some((participant) => String(participant.number) === String(state.adminLeaderNumber))) {
    state.adminLeaderNumber = fallbackLeaderNumber;
  }

  els.adminLeaderSelect.innerHTML = selectedParticipants
    .map((participant) => {
      const isLeader = String(participant.number) === String(fallbackLeaderNumber);
      const label = `${participant.number}. ${participant.name_english || participant.name_chinese || ''}${isLeader ? ' (current leader)' : ''}`;
      return `<option value="${participant.number}">${label}</option>`;
    })
    .join('');

  els.adminLeaderSelect.value = String(state.adminLeaderNumber);
}

function renderStats(filtered) {
  const total = state.entries.length;
  const leaders = new Set(filtered.map((entry) => entry.small_group_leader).filter(Boolean)).size;
  const genders = new Set(filtered.map((entry) => entry.gender_group).filter(Boolean)).size;

  els.stats.innerHTML = [
    `Total: ${total}`,
    `Showing: ${filtered.length}`,
    `Leaders: ${leaders}`,
    `Gender groups: ${genders}`,
  ]
    .map((text) => `<span class="stat">${text}</span>`)
    .join('');
}

function renderCards(filtered) {
  if (!filtered.length) {
    els.cards.innerHTML = '<div class="card">No entries match the current filters.</div>';
    return;
  }

  els.cards.innerHTML = filtered
    .map(
      (entry) => `
        <article class="card">
          <div class="card-top">
            <div>
              <h3 class="name-en">${entry.name_english || '&nbsp;'}</h3>
              <p class="name-cn">${entry.name_chinese || '&nbsp;'}</p>
            </div>
            <div class="badge">${entry.number}</div>
          </div>
          <div class="meta">
            <div><strong>Cell group leader:</strong> ${entry.small_group_leader || ''}</div>
            <div><strong>Gender group:</strong> ${entry.gender_group || ''}</div>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderRawJson() {
  els.rawJson.textContent = JSON.stringify(state.entries, null, 2);
  els.gameRawJson.textContent = JSON.stringify(
    {
      groups: state.gameEventGroups,
      participants: state.gameEventParticipants,
    },
    null,
    2,
  );
}

function setRawJsonView(view) {
  state.rawJsonView = view;
  const rosterViewActive = view === 'roster';

  els.rosterJsonTab.classList.toggle('is-active', rosterViewActive);
  els.gameJsonTab.classList.toggle('is-active', !rosterViewActive);

  els.rosterJsonPanel.hidden = !rosterViewActive;
  els.gameJsonPanel.hidden = rosterViewActive;
}

function setAdminUnlocked(unlocked) {
  state.adminUnlocked = unlocked;
  els.adminLockPanel.hidden = unlocked;
  els.adminViewerPanel.hidden = !unlocked;
  if (unlocked) {
    els.adminPassword.value = '';
    els.adminLockMessage.textContent = '';
  }
}

function updateGameGroupLeader(groupId, leaderNumber) {
  const numericGroupId = Number(groupId);
  const numericLeaderNumber = Number(leaderNumber);
  const group = getGroupById(numericGroupId);
  const leaderEntry = state.gameEventParticipants.find((participant) => Number(participant.number) === numericLeaderNumber);

  if (!group || !leaderEntry) {
    throw new Error('Please choose a valid game group and leader.');
  }

  const leaderConflict = state.gameEventGroups.find(
    (groupItem) => Number(groupItem.id) !== numericGroupId && Number(groupItem.leader_number) === numericLeaderNumber,
  );

  if (leaderConflict) {
    throw new Error('This person is already the leader of another game group.');
  }

  state.gameEventBackup = cloneGameEventData(state.gameEventGroups, state.gameEventParticipants);

  state.gameEventGroups = state.gameEventGroups.map((groupItem) => {
    if (Number(groupItem.id) !== numericGroupId) {
      return groupItem;
    }

    return {
      ...groupItem,
      leader_number: leaderEntry.number,
      leader_name_english: leaderEntry.name_english,
      leader_name_chinese: leaderEntry.name_chinese,
    };
  });

  state.gameEventParticipants = state.gameEventParticipants.map((participant) => {
    if (Number(participant.game_event_group_id) !== numericGroupId) {
      return participant;
    }

    return {
      ...participant,
      game_event_group_leader_number: leaderEntry.number,
      game_event_group_leader_name_english: leaderEntry.name_english,
      game_event_group_leader_name_chinese: leaderEntry.name_chinese,
      game_event_group_is_leader: Number(participant.number) === numericLeaderNumber,
    };
  });
}

function exportAdminData() {
  if (state.gameEventBackup) {
    downloadJson('game_event_groups.before-update.json', state.gameEventBackup);
  }

  downloadJson(gameEventDataUrl, {
    groups: state.gameEventGroups,
    participants: state.gameEventParticipants,
  });
}

function buildGameEventIndex() {
  return state.gameEventParticipants.map((entry) => ({
    ...entry,
    small_group_leader: canonicalize(entry.small_group_leader, leaderNormalization),
  }));
}

function gameMatches(entry) {
  const leaderQuery = normalize(state.gameLeaderSearch);
  const nameQuery = normalize(state.gameNameSearch);
  const searchableName = [entry.name_chinese, entry.name_english].map(normalize).join(' ');
  const searchableLeader = normalize(entry.small_group_leader);

  const hasLeaderQuery = Boolean(leaderQuery) && leaderQuery !== 'all';
  const hasNameQuery = Boolean(nameQuery);
  if (!hasLeaderQuery && !hasNameQuery) {
    return true;
  }

  const leaderMatches = hasLeaderQuery && searchKey(searchableLeader).includes(searchKey(leaderQuery));
  const nameMatches = hasNameQuery && searchKey(searchableName).includes(searchKey(nameQuery));

  return leaderMatches || nameMatches;
}

function renderGameStats(filtered) {
  const total = state.gameEventParticipants.length;
  const matchedGroups = new Set(filtered.map((entry) => entry.game_event_group_id)).size;

  els.gameStats.innerHTML = [
    `Participants: ${total}`,
    `Matched: ${filtered.length}`,
    `Groups: ${matchedGroups}`,
  ]
    .map((text) => `<span class="stat">${text}</span>`)
    .join('');
}

function renderGameResults(filtered) {
  if (!filtered.length) {
    els.gameResults.innerHTML = '<div class="card">No participants match the current search.</div>';
    return;
  }

  els.gameResults.innerHTML = filtered
    .map(
      (entry) => `
        <article class="card game-card ${entry.game_event_group_is_leader ? 'is-leader' : ''}">
          <div class="card-top">
            <div>
              <h3 class="name-en">${entry.name_english || '&nbsp;'}</h3>
              <p class="name-cn">${entry.name_chinese || '&nbsp;'}</p>
            </div>
            <div class="card-marks">
              <div class="badge">${entry.game_event_group_id}</div>
              ${entry.game_event_group_is_leader ? '<div class="role-pill">Leader</div>' : ''}
            </div>
          </div>
          <div class="meta">
            <div><strong>Game group:</strong> ${formatGameGroupName(entry.game_event_group_name)}</div>
            <div><strong>Game leader:</strong> ${formatName(entry.game_event_group_leader_name_english, entry.game_event_group_leader_name_chinese) || entry.small_group_leader || ''}</div>
            <div><strong>Member:</strong> ${entry.name_english || entry.name_chinese || ''}</div>
          </div>
        </article>
      `,
    )
    .join('');
}

function render() {
  const filtered = state.entries.filter(matches);
  renderStats(filtered);
  renderCards(filtered);
  renderRawJson();

  const gameFiltered = buildGameEventIndex().filter(gameMatches);
  renderGameStats(gameFiltered);
  renderGameResults(gameFiltered);
}

function setActiveTab(tab) {
  state.activeTab = tab;
  const rosterActive = tab === 'roster';
  const gameActive = tab === 'game';
  const adminActive = tab === 'admin';

  document.body.classList.toggle('game-lookup-active', gameActive);
  document.body.classList.toggle('json-view-active', adminActive);
  document.body.classList.toggle('non-roster-view-active', gameActive || adminActive);

  els.rosterTab.classList.toggle('is-active', rosterActive);
  els.rosterTab.setAttribute('aria-selected', String(rosterActive));
  els.gameTab.classList.toggle('is-active', gameActive);
  els.gameTab.setAttribute('aria-selected', String(gameActive));
  els.rawTab.classList.toggle('is-active', adminActive);
  els.rawTab.setAttribute('aria-selected', String(adminActive));

  els.rosterPanel.hidden = !rosterActive;
  els.gamePanel.hidden = !gameActive;
  els.rawPanel.hidden = !adminActive;

  if (adminActive) {
    setAdminUnlocked(state.adminUnlocked);
  }
}

async function main() {
  const rosterResponse = await fetch(dataUrl);

  if (!rosterResponse.ok) {
    throw new Error(`Failed to load ${dataUrl}: ${rosterResponse.status}`);
  }

  state.entries = (await rosterResponse.json()).map(normalizeRosterEntry);

  const gameEventData = await (await fetch(gameEventDataUrl)).json();
  state.gameEventGroups = (gameEventData.groups ?? []).map((entry) => ({ ...entry }));
  state.gameEventParticipants = (gameEventData.participants ?? []).map((entry) => ({
    ...entry,
    small_group_leader: canonicalize(entry.small_group_leader, leaderNormalization),
  }));

  els.search = document.getElementById('search');
  els.genderFilter = document.getElementById('genderFilter');
  els.leaderFilter = document.getElementById('leaderFilter');
  els.stats = document.getElementById('stats');
  els.cards = document.getElementById('cards');
  els.rawJson = document.getElementById('rawJson');
  els.gameRawJson = document.getElementById('gameRawJson');
  els.rosterTab = document.getElementById('roster-tab');
  els.gameTab = document.getElementById('game-tab');
  els.rawTab = document.getElementById('admin-tab');
  els.rosterPanel = document.getElementById('roster-panel');
  els.gamePanel = document.getElementById('game-panel');
  els.rawPanel = document.getElementById('admin-panel');
  els.adminLockPanel = document.getElementById('admin-lock-panel');
  els.adminViewerPanel = document.getElementById('admin-viewer-panel');
  els.adminPassword = document.getElementById('adminPassword');
  els.adminUnlockButton = document.getElementById('adminUnlockButton');
  els.adminLockMessage = document.getElementById('adminLockMessage');
  els.rosterJsonTab = document.getElementById('roster-json-tab');
  els.gameJsonTab = document.getElementById('game-json-tab');
  els.rosterJsonPanel = document.getElementById('roster-json-panel');
  els.gameJsonPanel = document.getElementById('game-json-panel');
  els.adminGroupSelect = document.getElementById('adminGroupSelect');
  els.adminLeaderSelect = document.getElementById('adminLeaderSelect');
  els.adminApplyButton = document.getElementById('adminApplyButton');
  els.adminExportButton = document.getElementById('adminExportButton');
  els.adminStatus = document.getElementById('adminStatus');
  els.gameLeaderSearch = document.getElementById('gameLeaderSearch');
  els.gameNameSearch = document.getElementById('gameNameSearch');
  els.gameStats = document.getElementById('gameStats');
  els.gameResults = document.getElementById('gameResults');

  renderFilters();
  renderGameLeaderFilter();
  setRawJsonView('roster');
  setAdminUnlocked(false);
  setActiveTab('game');
  render();

  els.search.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });

  els.genderFilter.addEventListener('change', (event) => {
    state.gender = event.target.value;
    render();
  });

  els.leaderFilter.addEventListener('change', (event) => {
    state.leader = event.target.value;
    render();
  });

  els.rosterTab.addEventListener('click', () => setActiveTab('roster'));
  els.gameTab.addEventListener('click', () => setActiveTab('game'));
  els.rawTab.addEventListener('click', () => setActiveTab('admin'));

  els.gameLeaderSearch.addEventListener('change', (event) => {
    state.gameLeaderSearch = event.target.value;
    render();
  });

  els.gameNameSearch.addEventListener('input', (event) => {
    state.gameNameSearch = event.target.value;
    render();
  });

  els.rosterJsonTab.addEventListener('click', () => setRawJsonView('roster'));
  els.gameJsonTab.addEventListener('click', () => setRawJsonView('game'));

  els.adminGroupSelect.addEventListener('change', (event) => {
    state.adminGroupId = event.target.value;
    renderAdminControls();
  });

  els.adminLeaderSelect.addEventListener('change', (event) => {
    state.adminLeaderNumber = event.target.value;
    renderAdminControls();
  });

  const unlockAdmin = () => {
    if (els.adminPassword.value.trim() === adminPassword) {
      setAdminUnlocked(true);
      setRawJsonView('roster');
      render();
      return;
    }

    els.adminLockMessage.textContent = 'Incorrect password.';
    els.adminPassword.focus();
  };

  els.adminUnlockButton.addEventListener('click', unlockAdmin);
  els.adminPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      unlockAdmin();
    }
  });

  els.adminApplyButton.addEventListener('click', () => {
    try {
      updateGameGroupLeader(els.adminGroupSelect.value, els.adminLeaderSelect.value);
      renderAdminControls();
      render();
      exportAdminData();
      els.adminStatus.textContent = 'Leader updated. Downloaded the updated JSON and a backup copy.';
    } catch (error) {
      els.adminStatus.textContent = error instanceof Error ? error.message : 'Unable to update leader.';
    }
  });

  els.adminExportButton.addEventListener('click', () => {
    try {
      exportAdminData();
      els.adminStatus.textContent = 'Downloaded the updated JSON and a backup copy.';
    } catch (error) {
      els.adminStatus.textContent = error instanceof Error ? error.message : 'Unable to export JSON.';
    }
  });

  renderAdminControls();
}

main().catch((error) => {
  document.body.innerHTML = `<pre style="padding: 24px; white-space: pre-wrap;">${error.stack || error.message}</pre>`;
});