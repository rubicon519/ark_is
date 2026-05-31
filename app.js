// --- State & Memory Variables ---
let INTEGRATED_STRATEGIES = [];
let OPERATORS = [];

const STORAGE_KEYS = {
  SELECTED_THEMES: "is_selector_selected_themes",
  EXCLUDED_BOSSES: "is_selector_excluded_bosses",
  PINNED_BOSSES: "is_selector_pinned_bosses",
  BAN_COUNT: "is_selector_ban_count",
  SETS_COUNT: "is_selector_sets_count",
  ESSENTIAL_OPS: "is_selector_essential_ops"
};

let state = {
  selectedThemes: JSON.parse(localStorage.getItem(STORAGE_KEYS.SELECTED_THEMES)) || [],
  excludedBosses: JSON.parse(localStorage.getItem(STORAGE_KEYS.EXCLUDED_BOSSES)) || null,
  pinnedBosses: JSON.parse(localStorage.getItem(STORAGE_KEYS.PINNED_BOSSES)) || [],
  banCount: parseInt(localStorage.getItem(STORAGE_KEYS.BAN_COUNT)) || 3,
  setsCount: parseInt(localStorage.getItem(STORAGE_KEYS.SETS_COUNT)) || 2,
  essentialOps: JSON.parse(localStorage.getItem(STORAGE_KEYS.ESSENTIAL_OPS)) || ["위셔델"]
};

// --- DOM Elements ---
const themeListContainer = document.getElementById('theme-list');
const bossListContainer = document.getElementById('boss-list');
const banCountVal = document.getElementById('ban-count-val');
const setsCountVal = document.getElementById('sets-count-val');
const resultsContainer = document.getElementById('results');

// --- Helper Functions ---
function saveState() {
  localStorage.setItem(STORAGE_KEYS.SELECTED_THEMES, JSON.stringify(state.selectedThemes));
  localStorage.setItem(STORAGE_KEYS.EXCLUDED_BOSSES, JSON.stringify(state.excludedBosses));
  localStorage.setItem(STORAGE_KEYS.PINNED_BOSSES, JSON.stringify(state.pinnedBosses));
  localStorage.setItem(STORAGE_KEYS.BAN_COUNT, state.banCount);
  localStorage.setItem(STORAGE_KEYS.SETS_COUNT, state.setsCount);
  localStorage.setItem(STORAGE_KEYS.ESSENTIAL_OPS, JSON.stringify(state.essentialOps));
}

// 보스의 층 번호 반환 (예: "6층 히든" → "6")
function getFloorKey(stage) {
  const m = stage.match(/^(\d+)층/);
  return m ? m[1] : null;
}

// --- Fetch Data & Initialization ---
async function init() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    INTEGRATED_STRATEGIES = data.INTEGRATED_STRATEGIES;
    OPERATORS = data.OPERATORS;

    if (state.excludedBosses === null) {
      state.excludedBosses = [];
      saveState();
    }
    // 최초 실행: selectedThemes가 없으면 빈 배열(아무 테마도 선택 안 됨)
    // pinnedBosses도 초기화
    if (!localStorage.getItem(STORAGE_KEYS.SELECTED_THEMES)) {
      state.selectedThemes = [];
      state.pinnedBosses = [];
      saveState();
    }

    renderThemes();
    renderBosses();
    updateCounters();
    initTomSelect();
    setupEventListeners();
  } catch (error) {
    console.error("데이터 로드 실패:", error);
    themeListContainer.innerHTML = `<div style="color: #ff4a4a; font-size: 13px;">서버 데이터 로드 실패: ${error.message}</div>`;
  }
}

// --- Theme Rendering ---
function renderThemes() {
  themeListContainer.innerHTML = '';
  INTEGRATED_STRATEGIES.forEach(theme => {
    const label = document.createElement('label');
    label.className = 'custom-checkbox';
    const isSelected = state.selectedThemes.includes(theme.id);
    label.innerHTML = `
      <input type="checkbox" data-theme-id="${theme.id}" ${isSelected ? 'checked' : ''}>
      <span class="checkmark"></span>
      <img src="./${theme.id}.png" style="height:110px; ">
    `;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      const themeId = e.target.dataset.themeId;
      const themeObj = INTEGRATED_STRATEGIES.find(t => t.id === themeId);
      if (e.target.checked) {
        // 테마 선택: selectedThemes에 추가, 해당 보스 전체 고정
        if (!state.selectedThemes.includes(themeId)) {
          state.selectedThemes.push(themeId);
        }
        if (themeObj) {
          themeObj.bosses.forEach(b => {
            state.excludedBosses = state.excludedBosses.filter(id => id !== b.id);
            if (!state.pinnedBosses.includes(b.id)) state.pinnedBosses.push(b.id);
          });
        }
      } else {
        // 테마 해제: selectedThemes에서 제거, 해당 보스 고정/제외 초기화
        state.selectedThemes = state.selectedThemes.filter(id => id !== themeId);
        if (themeObj) {
          themeObj.bosses.forEach(b => {
            state.pinnedBosses = state.pinnedBosses.filter(id => id !== b.id);
            state.excludedBosses = state.excludedBosses.filter(id => id !== b.id);
          });
        }
      }
      saveState();
      renderBosses();
    });
    themeListContainer.appendChild(label);
  });
}

// --- Boss Rendering (표 형식, 고정/제외) ---
function renderBosses() {
  bossListContainer.innerHTML = '';

  const activeThemes = INTEGRATED_STRATEGIES.filter(t => state.selectedThemes.includes(t.id));

  if (activeThemes.length === 0) {
    bossListContainer.innerHTML = `<div style="color: var(--text-disabled); font-size: 13px;">통합전략 테마를 선택하면 보스 목록이 표시됩니다.</div>`;
    return;
  }

  // 헤더 행
  const header = document.createElement('div');
  header.className = 'boss-table-header';
  header.innerHTML = `
    <span class="boss-table-name"></span>
    <span class="boss-table-col">고정</span>
    <span class="boss-table-col">제외</span>
  `;
  bossListContainer.appendChild(header);

  activeThemes.forEach(theme => {
    theme.bosses.forEach(boss => {
      const isPinned = state.pinnedBosses.includes(boss.id);
      const isExcluded = state.excludedBosses.includes(boss.id);

      const row = document.createElement('div');
      row.className = 'boss-table-row';
      row.innerHTML = `
        <span class="boss-table-name">
          ${boss.name}
          <span class="boss-badge-info">${boss.stage}</span>
        </span>
        <span class="boss-table-col">
          <input type="checkbox" class="boss-pin-cb" data-boss-id="${boss.id}" data-theme-id="${theme.id}" ${isPinned ? 'checked' : ''}>
        </span>
        <span class="boss-table-col">
          <input type="checkbox" class="boss-exc-cb" data-boss-id="${boss.id}" data-theme-id="${theme.id}" ${isExcluded ? 'checked' : ''}>
        </span>
      `;

      // 고정 체크박스
      row.querySelector('.boss-pin-cb').addEventListener('change', (e) => {
        const bossId = e.target.dataset.bossId;
        const themeId = e.target.dataset.themeId;
        const themeObj = INTEGRATED_STRATEGIES.find(t => t.id === themeId);

        if (e.target.checked) {
          // 고정 추가
          if (!state.pinnedBosses.includes(bossId)) state.pinnedBosses.push(bossId);
          // 제외와 상호배제: 제외 해제
          state.excludedBosses = state.excludedBosses.filter(id => id !== bossId);
        } else {
          state.pinnedBosses = state.pinnedBosses.filter(id => id !== bossId);
        }
        saveState();
        renderBosses();
      });

      // 제외 체크박스
      row.querySelector('.boss-exc-cb').addEventListener('change', (e) => {
        const bossId = e.target.dataset.bossId;
        const themeId = e.target.dataset.themeId;
        const themeObj = INTEGRATED_STRATEGIES.find(t => t.id === themeId);

        if (e.target.checked) {
          // 제외 추가
          if (!state.excludedBosses.includes(bossId)) state.excludedBosses.push(bossId);
          // 고정과 상호배제: 고정 해제
          state.pinnedBosses = state.pinnedBosses.filter(id => id !== bossId);
          // 5층 기본/히든 제외 상호배제 유지
          if (themeObj) {
            const boss = themeObj.bosses.find(b => b.id === bossId);
            if (boss && (boss.stage === '5층 기본' || boss.stage === '5층 히든')) {
              const pairStage = boss.stage === '5층 기본' ? '5층 히든' : '5층 기본';
              const pair = themeObj.bosses.find(b => b.stage === pairStage);
              if (pair && state.excludedBosses.includes(pair.id)) {
                state.excludedBosses = state.excludedBosses.filter(id => id !== pair.id);
              }
            }
          }
        } else {
          state.excludedBosses = state.excludedBosses.filter(id => id !== bossId);
        }
        saveState();
        renderBosses();
      });

      bossListContainer.appendChild(row);
    });
  });
}

// --- Essential Operators (Tom Select) ---
let tomSelectInstance = null;

function initTomSelect() {
  // OPERATORS가 로드된 후 호출됨
  const select = document.getElementById('essential-select');
  if (!select) return;

  // 옵션 채우기
  OPERATORS.forEach(op => {
    const option = document.createElement('option');
    option.value = op.name;
    option.textContent = op.name;
    option.dataset.class = op.class;
    if (state.essentialOps.includes(op.name)) option.selected = true;
    select.appendChild(option);
  });

  tomSelectInstance = new TomSelect('#essential-select', {
    plugins: ['remove_button'],
    maxOptions: null,
    placeholder: '오퍼레이터 검색 후 선택...',
    render: {
      option: (data, escape) => {
        const op = OPERATORS.find(o => o.name === data.value);
        const cls = op ? op.class : '';
        return `<div class="ts-custom-option">
          <span>${escape(data.text)}</span>
          <span class="op-class-tag">${escape(cls)}</span>
        </div>`;
      },
      item: (data, escape) => `<div>${escape(data.text)}</div>`
    },
    onItemAdd(value) {
      if (!state.essentialOps.includes(value)) state.essentialOps.push(value);
      saveState();
    },
    onItemRemove(value) {
      state.essentialOps = state.essentialOps.filter(v => v !== value);
      saveState();
    }
  });
}

function updateCounters() {
  banCountVal.textContent = state.banCount;
  setsCountVal.textContent = state.setsCount;
}

function setupEventListeners() {
  document.getElementById('btn-ban-minus').addEventListener('click', () => {
    if (state.banCount > 0) { state.banCount--; saveState(); updateCounters(); }
  });
  document.getElementById('btn-ban-plus').addEventListener('click', () => {
    if (state.banCount < 8) { state.banCount++; saveState(); updateCounters(); }
  });
  document.getElementById('btn-sets-minus').addEventListener('click', () => {
    if (state.setsCount > 0) { state.setsCount--; saveState(); updateCounters(); }
  });
  document.getElementById('btn-sets-plus').addEventListener('click', () => {
    if (state.setsCount < 3) { state.setsCount++; saveState(); updateCounters(); }
  });
  document.getElementById('btn-match').addEventListener('click', triggerMatch);
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('모든 설정을 초기화할까요?')) {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      location.reload();
    }
  });
}


// --- Matching Logic ---
function triggerMatch() {
  const activeThemes = INTEGRATED_STRATEGIES.filter(t => state.selectedThemes.includes(t.id));
  if (activeThemes.length === 0) {
    alert("선택된 통합전략 테마가 없습니다. 테마를 하나 이상 선택해 주세요.");
    return;
  }
  const pickedTheme = activeThemes[Math.floor(Math.random() * activeThemes.length)];

  const activeBosses = pickedTheme.bosses.filter(b => !state.excludedBosses.includes(b.id));

  // 5층 처리: 고정 보스 우선, 없으면 랜덤
  const floor5All = activeBosses.filter(b => b.stage === '5층 기본' || b.stage === '5층 히든');
  const floor5Pinned = floor5All.filter(b => state.pinnedBosses.includes(b.id));
  const floor5Pool = floor5Pinned.length > 0 ? floor5Pinned : floor5All;

  if (floor5Pool.length === 0) {
    alert(`선택된 '${pickedTheme.name}' 테마에 활성화된 5층 보스가 없습니다.`);
    return;
  }
  const picked5 = floor5Pool[Math.floor(Math.random() * floor5Pool.length)];

  // 6층/7층 처리: 층별로 고정→랜덤→null 순서
  const upperFloorKeys = [...new Set(
    pickedTheme.bosses
      .filter(b => !b.stage.startsWith('5층'))
      .map(b => getFloorKey(b.stage))
  )].sort();

  const routeParts = [picked5.name];

  upperFloorKeys.forEach(floorKey => {
    const candidates = activeBosses.filter(b => getFloorKey(b.stage) === floorKey);
    const pinned = candidates.filter(b => state.pinnedBosses.includes(b.id));

    let pick;
    if (pinned.length > 0) {
      // 고정 보스가 있으면 반드시 선택
      pick = pinned[Math.floor(Math.random() * pinned.length)];
    } else {
      // 고정 없으면 랜덤 또는 선택하지 않음
      const pool = [...candidates, null];
      pick = pool[Math.floor(Math.random() * pool.length)];
    }

    if (pick !== null) routeParts.push(pick.name);
  });

  const routeText = routeParts.join(' - ');
  document.getElementById('res-theme').textContent = pickedTheme.name;
  document.getElementById('res-boss').textContent = routeText;

  // --- Ban Sets ---
  const banSetsContainer = document.getElementById('res-ban-sets');
  banSetsContainer.innerHTML = '';

  if (state.setsCount === 0 || state.banCount === 0) {
    banSetsContainer.innerHTML = `<div style="color: var(--text-secondary); grid-column: 1/-1;">밴 추천 설정이 꺼져 있습니다.</div>`;
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
    renderScreenshotBtn();
    return;
  }

  const rawPool = OPERATORS.filter(op => !state.essentialOps.includes(op.name));

  // 밴 풀 부족 체크
  if (state.banCount > 0 && rawPool.length < state.banCount) {
    alert(`밴 가능한 오퍼레이터(${rawPool.length}명)가 세트당 밴 수(${state.banCount}명)보다 적습니다.\n필수 오퍼레이터를 줄이거나 밴 수를 조정해 주세요.`);
    return;
  }

  for (let i = 1; i <= state.setsCount; i++) {
    const banCard = document.createElement('div');
    banCard.className = 'ban-set-card';
    banCard.innerHTML = `<div class="ban-set-title">SET ${i}</div>`;

    const banOpList = document.createElement('div');
    banOpList.className = 'ban-operator-list';

    const shuffled = [...rawPool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, state.banCount);

    selected.forEach(op => {
      const opItem = document.createElement('div');
      opItem.className = 'ban-operator-item';
      opItem.innerHTML = `<span>${op.name}</span><span class="op-class-tag">${op.class}</span>`;
      banOpList.appendChild(opItem);
    });

    banCard.appendChild(banOpList);
    banSetsContainer.appendChild(banCard);
  }

  // 세트 1개면 자동 선택
  if (state.setsCount === 1) {
    const onlyCard = banSetsContainer.querySelector('.ban-set-card');
    if (onlyCard) onlyCard.classList.add('selected');
  }

  resultsContainer.style.display = 'block';
  resultsContainer.scrollIntoView({ behavior: 'smooth' });

  // 카드 클릭 토글 (중복 방지: cloneNode로 교체)
  const freshContainer = banSetsContainer.cloneNode(true);
  banSetsContainer.parentNode.replaceChild(freshContainer, banSetsContainer);

  freshContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.ban-set-card');
    if (!card) return;
    const allCards = freshContainer.querySelectorAll('.ban-set-card');
    const isAlreadySelected = card.classList.contains('selected');
    allCards.forEach(c => c.classList.remove('selected', 'dimmed'));
    if (!isAlreadySelected) {
      card.classList.add('selected');
      allCards.forEach(c => { if (c !== card) c.classList.add('dimmed'); });
    }
    updateScreenshotBtn();
  });

  renderScreenshotBtn();
}

// --- Screenshot ---
function renderScreenshotBtn() {
  const existing = document.getElementById('btn-screenshot');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.id = 'btn-screenshot';
  btn.className = 'btn-screenshot';
  btn.textContent = '📸 결과 저장 (PNG)';
  btn.addEventListener('click', captureResult);
  resultsContainer.appendChild(btn);
  updateScreenshotBtn();
}

function updateScreenshotBtn() {
  const btn = document.getElementById('btn-screenshot');
  if (!btn) return;
  const container = document.getElementById('res-ban-sets');
  const cards = container.querySelectorAll('.ban-set-card');
  const hasSelected = container.querySelector('.ban-set-card.selected');
  const hasNoSets = cards.length === 0;
  btn.style.display = (hasNoSets || hasSelected) ? 'flex' : 'none';
}

async function captureResult() {
  const btn = document.getElementById('btn-screenshot');
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }
  btn.style.display = 'none';
  const canvas = await html2canvas(resultsContainer, {
    backgroundColor: '#12161c',
    scale: 2,
    useCORS: true,
    logging: false
  });
  btn.style.display = 'flex';
  const link = document.createElement('a');
  link.download = `arknights_is_result_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

init();
