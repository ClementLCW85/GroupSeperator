const assetVersion = '202606121534';
const dataUrl = `联合小组 2 - Full Name List (updated).json?v=${assetVersion}`;
const gameEventDataUrl = `game_event_groups.json?v=${assetVersion}`;
const adminPassword = '7212';

const leaderNormalization = {
  alan: 'Ps Alan',
  huiyee: 'Hui Yee',
  祥辉: 'Siang Fei',
  丽环: 'Lee Hwan',
};

const ageGroupNormalization = {
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

const ageGroupOrder = ['Kid', 'Teen', 'Elderly', 'Young Adult', 'Adult'];

const fruitCatalog = [
  { key: 'strawberry', label: 'Strawberry' },
  { key: 'watermelon', label: 'Watermelon' },
  { key: 'mango', label: 'Mango' },
  { key: 'pineapple', label: 'Pineapple' },
  { key: 'kiwi', label: 'Kiwi' },
  { key: 'grapes', label: 'Grapes' },
  { key: 'cherries', label: 'Cherries' },
  { key: 'orange', label: 'Orange' },
  { key: 'dragon-fruit', label: 'Dragon fruit' },
];

const noCellGroupLeaderValue = '__no_cell_group_leader__';

const state = {
  entries: [],
  gameEventGroups: [],
  gameEventParticipants: [],
  gameEventMasters: [],
  activeTab: 'game',
  rawJsonView: 'roster',
  adminUnlocked: false,
  adminGroupId: '',
  adminLeaderNumber: '',
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

  if (/\p{Script=Han}/u.test(trimmedName)) {
    return trimmedName;
  }

  const chineseName = gameGroupChineseNames[trimmedName];
  return chineseName ? `${trimmedName} ${chineseName}` : trimmedName;
}

function buildFruitAssetPath(fruitKey) {
  return `assets/fruits/${fruitKey}.png`;
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

function shuffle(values) {
  const items = values.slice();

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function createCountMap() {
  return new Map();
}

function incrementCount(countMap, key) {
  countMap.set(key, (countMap.get(key) ?? 0) + 1);
}

function getCount(countMap, key) {
  return countMap.get(key) ?? 0;
}

function createGameGroupTemplates() {
  return state.gameEventGroups.map((group) => ({
    id: Number(group.id),
    name: group.name,
    capacity: Number(group.capacity) || 0,
    members: [],
    ageCounts: createCountMap(),
    genderCounts: createCountMap(),
  }));
}

const fruitKeyByGroupId = {
  1: 'grapes',
  2: 'orange',
  3: 'cherries',
  4: 'dragon-fruit',
  5: 'kiwi',
  6: 'pineapple',
  7: 'mango',
  8: 'watermelon',
  9: 'strawberry',
};

function assignFruitMetadata(groups) {
  groups.forEach((group) => {
    const fruitKey = fruitKeyByGroupId[Number(group.id)];
    const fruit = fruitCatalog.find((item) => item.key === fruitKey);
    if (!fruit) {
      return;
    }
    group.fruit_key = fruit.key;
    group.fruit_name = fruit.label;
    group.fruit_asset = buildFruitAssetPath(fruit.key);
  });
}

function chooseBalancedGameGroup(groups, entry) {
  const rankedGroups = groups
    .filter((group) => group.members.length < group.capacity)
    .map((group) => {
      const sameAgeCount = getCount(group.ageCounts, entry.age_group);
      const sameGenderCount = getCount(group.genderCounts, entry.gender);
      const maleAfter = getCount(group.genderCounts, 'male') + (entry.gender === 'male' ? 1 : 0);
      const femaleAfter = getCount(group.genderCounts, 'female') + (entry.gender === 'female' ? 1 : 0);

      return {
        group,
        score: [
          group.members.length,
          sameAgeCount,
          sameGenderCount,
          Math.abs(maleAfter - femaleAfter),
          Math.random(),
        ],
      };
    });

  rankedGroups.sort((left, right) => {
    for (let index = 0; index < left.score.length; index += 1) {
      if (left.score[index] < right.score[index]) {
        return -1;
      }

      if (left.score[index] > right.score[index]) {
        return 1;
      }
    }

    return 0;
  });

  return rankedGroups[0]?.group ?? null;
}

function buildRebalancedGameEventData() {
  const gameMasterNumbers = new Set(state.gameEventMasters.map((master) => String(master.number)));
  const participants = state.entries.filter((entry) => !gameMasterNumbers.has(String(entry.number)));
  const groups = createGameGroupTemplates();

  ageGroupOrder.forEach((ageGroup) => {
    shuffle(participants.filter((entry) => entry.age_group === ageGroup)).forEach((entry) => {
      const selectedGroup = chooseBalancedGameGroup(groups, entry);

      if (!selectedGroup) {
        throw new Error('Unable to place every participant into a game group.');
      }

      selectedGroup.members.push(entry);
      incrementCount(selectedGroup.ageCounts, entry.age_group);
      incrementCount(selectedGroup.genderCounts, entry.gender);
    });
  });

  groups.forEach((group) => {
    if (!group.members.length) {
      group.leader = null;
      return;
    }

    const leaderCandidates = group.members.filter((member) => member.age_group !== 'Kid');

    if (!leaderCandidates.length) {
      throw new Error(`Game group ${group.id} does not have a non-kid leader candidate.`);
    }

    group.leader = leaderCandidates[Math.floor(Math.random() * leaderCandidates.length)];
  });

  assignFruitMetadata(groups);

  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      capacity: group.capacity,
      member_count: group.members.length,
      leader_number: group.leader ? group.leader.number : null,
      leader_name_english: group.leader ? group.leader.name_english : '',
      leader_name_chinese: group.leader ? group.leader.name_chinese : '',
      fruit_key: group.fruit_key,
      fruit_name: group.fruit_name,
      fruit_asset: group.fruit_asset,
      age_group_breakdown: Object.fromEntries(
        ageGroupOrder
          .map((ageGroup) => [ageGroup, getCount(group.ageCounts, ageGroup)])
          .filter(([, count]) => count > 0),
      ),
    })),
    participants: groups.flatMap((group) =>
      group.members.map((member) => ({
        ...member,
        game_event_group_id: group.id,
        game_event_group_name: formatGameGroupName(group.name),
        game_event_group_leader_number: group.leader ? group.leader.number : null,
        game_event_group_leader_name_english: group.leader ? group.leader.name_english : '',
        game_event_group_leader_name_chinese: group.leader ? group.leader.name_chinese : '',
        game_event_group_fruit_key: group.fruit_key,
        game_event_group_fruit_name: group.fruit_name,
        game_event_group_fruit_asset: group.fruit_asset,
        game_event_group_is_leader: Boolean(group.leader && member.number === group.leader.number),
      })),
    ),
    game_masters: state.gameEventMasters.map((master) => ({ ...master })),
  };
}

function normalizeRosterEntry(entry) {
  return {
    ...entry,
    small_group_leader: canonicalize(entry.small_group_leader, leaderNormalization),
    age_group: canonicalize(entry.age_group, ageGroupNormalization),
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
    entry.age_group,
  ]
    .map(searchKey)
    .join(' ');

  const searchOk = !state.search || haystack.includes(searchKey(state.search));
  const genderOk = state.gender === 'All' || searchKey(entry.age_group) === searchKey(state.gender);
  const leaderOk = state.leader === 'All' || searchKey(entry.small_group_leader) === searchKey(state.leader);

  return searchOk && genderOk && leaderOk;
}

function renderFilters() {
  const genders = ['All', ...unique(state.entries.map((entry) => entry.age_group))];
  const leaders = ['All', ...unique(state.entries.map((entry) => entry.small_group_leader))];

  els.genderFilter.innerHTML = genders.map((value) => `<option value="${value}">${value}</option>`).join('');
  els.leaderFilter.innerHTML = leaders.map((value) => `<option value="${value}">${value}</option>`).join('');

  els.genderFilter.value = state.gender;
  els.leaderFilter.value = state.leader;
}

function renderGameLeaderFilter() {
  const leaders = [
    { value: 'All', label: 'All' },
    ...(state.gameEventParticipants.some((entry) => !entry.small_group_leader)
      ? [{ value: noCellGroupLeaderValue, label: 'No cell group leader' }]
      : []),
    ...unique(state.gameEventParticipants.map((entry) => entry.small_group_leader)).map((value) => ({
      value,
      label: value,
    })),
  ];

  els.gameLeaderSearch.innerHTML = leaders.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');
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
      const name = participant.name_english || participant.name_chinese || '';
      const ageCategory = participant.age_group ? ` (${participant.age_group})` : '';
      const label = `${participant.number}. ${name}${ageCategory}${isLeader ? ' (current leader)' : ''}`;
      return `<option value="${participant.number}">${label}</option>`;
    })
    .join('');

  els.adminLeaderSelect.value = String(state.adminLeaderNumber);
}

function renderStats(filtered) {
  const total = state.entries.length;
  const leaders = new Set(filtered.map((entry) => entry.small_group_leader).filter(Boolean)).size;
  const genders = new Set(filtered.map((entry) => entry.age_group).filter(Boolean)).size;

  els.stats.innerHTML = [
    `Total: ${total}`,
    `Showing: ${filtered.length}`,
    `Leaders: ${leaders}`,
    `Age groups: ${genders}`,
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
            <div><strong>Age group:</strong> ${entry.age_group || ''}</div>
            <div><strong>Gender:</strong> ${entry.gender || ''}</div>
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
      game_masters: state.gameEventMasters,
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

function exportCurrentGameEventData() {
  downloadJson('game_event_groups.json', {
    groups: state.gameEventGroups,
    participants: state.gameEventParticipants,
    game_masters: state.gameEventMasters,
  });
}

function regroupGameGroups() {
  const regrouped = buildRebalancedGameEventData();
  state.gameEventGroups = regrouped.groups;
  state.gameEventParticipants = regrouped.participants;
  state.gameEventMasters = regrouped.game_masters;
}

function buildGameEventIndex() {
  const participants = state.gameEventParticipants.map((entry) => ({
    ...entry,
    small_group_leader: canonicalize(entry.small_group_leader, leaderNormalization),
    is_game_master: false,
    ...(getGroupById(entry.game_event_group_id)
      ? {
          game_event_group_fruit_key: getGroupById(entry.game_event_group_id).fruit_key || '',
          game_event_group_fruit_name: getGroupById(entry.game_event_group_id).fruit_name || '',
          game_event_group_fruit_asset: getGroupById(entry.game_event_group_id).fruit_asset || '',
        }
      : {}),
  }));

  const gameMasters = state.gameEventMasters.map((entry) => ({
    ...entry,
    game_event_group_id: 'GM',
    game_event_group_name: 'Game master',
    game_event_group_leader_number: null,
    game_event_group_leader_name_english: '',
    game_event_group_leader_name_chinese: '',
    game_event_group_is_leader: false,
    is_game_master: true,
    small_group_leader: '',
  }));

  return [...participants, ...gameMasters];
}

function gameMatches(entry) {
  const leaderQuery = normalize(state.gameLeaderSearch);
  const nameQuery = normalize(state.gameNameSearch);
  const searchableName = [entry.name_chinese, entry.name_english].map(normalize).join(' ');
  const searchableLeader = normalize(entry.small_group_leader);

  const hasLeaderQuery = Boolean(leaderQuery) && leaderQuery !== 'all';
  const hasNameQuery = Boolean(nameQuery);

  if (entry.is_game_master) {
    if (hasNameQuery) {
      return searchKey(searchableName).includes(searchKey(nameQuery));
    }

    return !hasLeaderQuery;
  }

  if (!hasLeaderQuery && !hasNameQuery) {
    return true;
  }

  const leaderMatches = hasLeaderQuery
    && (
      leaderQuery === noCellGroupLeaderValue
        ? !searchableLeader
        : searchKey(searchableLeader).includes(searchKey(leaderQuery))
    );
  const nameMatches = hasNameQuery && searchKey(searchableName).includes(searchKey(nameQuery));

  return leaderMatches || nameMatches;
}

function renderGameStats(filtered) {
  const participantTotal = state.gameEventParticipants.length;
  const gameMasterTotal = state.gameEventMasters.length;
  const matchedGroups = new Set(filtered.map((entry) => entry.game_event_group_id)).size;
  const groupCounts = new Map(state.gameEventGroups.map((group) => [String(group.id), 0]));

  state.gameEventParticipants.forEach((participant) => {
    const groupId = String(participant.game_event_group_id);
    groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
  });

  const availabilityChips = state.gameEventGroups
    .slice()
    .sort((left, right) => Number(left.id) - Number(right.id))
    .map((group) => `<span class="stat">${group.id}. ${formatGameGroupName(group.name)}: ${groupCounts.get(String(group.id)) ?? 0}</span>`);

  els.gameStats.innerHTML = [
    `<span class="stat">Participants: ${participantTotal}</span>`,
    `<span class="stat">Game masters: ${gameMasterTotal}</span>`,
    `<span class="stat">Matched: ${filtered.length}</span>`,
    `<span class="stat">Groups: ${matchedGroups}</span>`,
    `<details class="game-availability">
      <summary>Group availability and placement note</summary>
      <div class="game-availability-body">
        <p>If you find a new unregistered person, prioritize the group with fewer people.</p>
        <div class="game-availability-chips">${availabilityChips.join('')}</div>
      </div>
    </details>`,
  ].join('');
}

function renderGameResults(filtered) {
  if (!filtered.length) {
    els.gameResults.innerHTML = '<div class="card">No participants match the current search.</div>';
    return;
  }

  els.gameResults.innerHTML = filtered
    .map(
      (entry) => `
        <article class="card game-card ${entry.is_game_master ? 'is-gm' : entry.game_event_group_is_leader ? 'is-leader' : ''}">
          <div class="card-top">
            <div>
              <h3 class="name-en">${entry.name_english || '&nbsp;'}</h3>
              <p class="name-cn">${entry.name_chinese || '&nbsp;'}</p>
            </div>
            <div class="card-marks">
              <div class="group-mark">
                ${entry.is_game_master || !entry.game_event_group_fruit_asset ? '' : `<span class="fruit-tile" style="--fruit-image: url('${entry.game_event_group_fruit_asset}')" aria-hidden="true"></span>`}
                <div class="badge">${entry.is_game_master ? 'GM' : entry.game_event_group_id}</div>
              </div>
              ${entry.game_event_group_is_leader ? '<div class="role-pill">Leader</div>' : ''}
            </div>
          </div>
          <div class="meta">
            <div><strong>Game group:</strong> ${entry.is_game_master ? 'Game master' : formatGameGroupName(entry.game_event_group_name)}</div>
            <div><strong>Game leader:</strong> ${entry.is_game_master ? 'N/A' : formatName(entry.game_event_group_leader_name_english, entry.game_event_group_leader_name_chinese) || entry.small_group_leader || ''}</div>
            <div><strong>Member:</strong> ${entry.name_english || entry.name_chinese || ''}</div>
            <div><strong>Age group:</strong> ${entry.age_group || ''}</div>
            <div><strong>Gender:</strong> ${entry.gender || ''}</div>
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
  state.gameEventMasters = (gameEventData.game_masters ?? []).map((entry) => ({ ...entry }));

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
  els.adminRegroupButton = document.getElementById('adminRegroupButton');
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

  if (els.adminApplyButton) {
    els.adminApplyButton.addEventListener('click', () => {
      try {
        updateGameGroupLeader(els.adminGroupSelect.value, els.adminLeaderSelect.value);
        renderAdminControls();
        render();
        els.adminStatus.textContent = 'Leader updated.';
      } catch (error) {
        els.adminStatus.textContent = error instanceof Error ? error.message : 'Unable to update leader.';
      }
    });
  }

  if (els.adminRegroupButton) {
    els.adminRegroupButton.addEventListener('click', () => {
      try {
        regroupGameGroups();
        renderAdminControls();
        render();
        els.adminStatus.textContent = 'Game groups rebuilt.';
      } catch (error) {
        els.adminStatus.textContent = error instanceof Error ? error.message : 'Unable to rebuild game groups.';
      }
    });
  }

  if (els.adminExportButton) {
    els.adminExportButton.addEventListener('click', () => {
      try {
        exportCurrentGameEventData();
        els.adminStatus.textContent = 'Downloaded game_event_groups.json.';
      } catch (error) {
        els.adminStatus.textContent = error instanceof Error ? error.message : 'Unable to export JSON.';
      }
    });
  }

  renderAdminControls();
}

main().catch((error) => {
  document.body.innerHTML = `<pre style="padding: 24px; white-space: pre-wrap;">${error.stack || error.message}</pre>`;
});