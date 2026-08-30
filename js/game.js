import {
  auth, db,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "./firebase-config.js";
import { ROLES, ROLE_LIST, ACTIONS, mustCoup, shuffle } from "./game-rules.js";
import { initPageTransition, navigateTo } from "./page-transition.js";
initPageTransition();

const params = new URLSearchParams(window.location.search);
const roomCode = params.get("code");
if (!roomCode) navigateTo("home.html");

let myUid = null;
let room = null;
let myCards = [];
let pendingTargetAction = null; // actionId waiting for target click

const roleIcon = (role) => {
  // Siluet karakter simpel + motif khas tiap role, gaya flat vector (bukan foto/AI-art)
  const icons = {
    daimyo: `<svg viewBox="0 0 48 48">
      <path d="M24 4l3 8h9l-7 6 3 9-8-5-8 5 3-9-7-6h9z" fill="#b5892c"/>
      <path d="M14 34c2-6 6-9 10-9s8 3 10 9v6H14z" fill="#b5892c" opacity="0.9"/>
    </svg>`,
    ronin: `<svg viewBox="0 0 48 48">
      <circle cx="24" cy="12" r="6" fill="#a83a32"/>
      <path d="M15 40c1-8 4-13 9-13s8 5 9 13z" fill="#a83a32"/>
      <rect x="30" y="8" width="4" height="22" rx="1.5" fill="#a83a32" transform="rotate(30 32 19)"/>
    </svg>`,
    kaizoku: `<svg viewBox="0 0 48 48">
      <circle cx="24" cy="13" r="6" fill="#2c7a6b"/>
      <path d="M14 40c1-9 5-14 10-14s9 5 10 14z" fill="#2c7a6b"/>
      <path d="M14 12h20l-3 5H17z" fill="#1f5951"/>
      <circle cx="21" cy="13" r="1.4" fill="#fff"/>
    </svg>`,
    kitsune: `<svg viewBox="0 0 48 48">
      <path d="M24 6l14 9-4 17-10 8-10-8-4-17z" fill="#6a4e9e"/>
      <path d="M17 20l7 5 7-5-2 8-5 4-5-4z" fill="#fff" opacity="0.85"/>
      <circle cx="19" cy="22" r="1.8" fill="#2b2420"/>
      <circle cx="29" cy="22" r="1.8" fill="#2b2420"/>
    </svg>`,
    miko: `<svg viewBox="0 0 48 48">
      <circle cx="24" cy="12" r="6" fill="#b04a76"/>
      <path d="M15 40c1-9 4-14 9-14s8 5 9 14z" fill="#b04a76"/>
      <circle cx="24" cy="30" r="3.5" fill="#fff8ee" opacity="0.9"/>
    </svg>`
  };
  return icons[role] || "";
};

function roleCardHtml(role, opts = {}) {
  const r = ROLES[role];
  const dead = opts.dead;
  return `
    <div class="role-card role-tag-${r.color} ${dead ? "revealed" : ""}">
      <div class="role-icon">${roleIcon(role)}</div>
      <div class="role-name">${r.name}</div>
      <div class="role-desc">${r.desc}</div>
    </div>
  `;
}

function faceDownCardHtml() {
  return `
    <div class="role-card face-down">
      <div class="role-icon"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" fill="none" stroke="#d9b45a" stroke-width="2"/></svg></div>
      <div class="role-name">???</div>
    </div>
  `;
}

onAuthStateChanged(auth, (user) => {
  if (!user || !user.emailVerified) {
    navigateTo("login.html");
    return;
  }
  myUid = user.uid;
  listenRoom();
  listenMyCards();
});

function listenRoom() {
  const roomRef = doc(db, "rooms", roomCode);
  onSnapshot(roomRef, (snap) => {
    if (!snap.exists()) {
      alert("Room sudah tidak ada.");
      navigateTo("home.html");
      return;
    }
    room = snap.data();
    if (room.status === "waiting") {
      navigateTo(`room.html?code=${roomCode}`);
      return;
    }
    render();
  });
}

function listenMyCards() {
  const cardRef = doc(db, "rooms", roomCode, "privateCards", myUid);
  onSnapshot(cardRef, (snap) => {
    myCards = snap.exists() ? snap.data().cards : [];
    render();
  });
}

document.getElementById("guideBtn").addEventListener("click", showGuide);
document.getElementById("leaveGameBtn").addEventListener("click", () => {
  if (confirm("Yakin mau tinggalkan permainan?")) navigateTo("home.html");
});

function showGuide() {
  const modalRoot = document.getElementById("modalRoot");
  const items = Object.values(ACTIONS)
    .map((a) => `
      <div class="guide-item">
        <div class="g-title">${a.name}${a.cost ? ` (${a.cost} koin)` : ""}</div>
        <div class="g-desc">${a.desc}${a.requiresRole ? ` Butuh kartu ${ROLES[a.requiresRole].name}.` : ""}</div>
      </div>
    `).join("");
  const roles = Object.values(ROLES)
    .map((r) => `
      <div class="guide-item">
        <div class="g-title">${r.name}</div>
        <div class="g-desc">${r.desc}</div>
      </div>
    `).join("");
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="guideOverlay">
      <div class="modal-box">
        <h3>Panduan cepat</h3>
        <p class="hint">Setiap aksi bisa di-bluff. Lawan boleh menantang (challenge) klaim kartumu. Kalau ketahuan bluff, kamu gugurkan 1 kartu.</p>
        <h3 style="margin-top:16px;">Karakter</h3>
        ${roles}
        <h3 style="margin-top:16px;">Aksi</h3>
        ${items}
        <button id="closeGuide" style="margin-top:16px;">Tutup</button>
      </div>
    </div>
  `;
  document.getElementById("closeGuide").addEventListener("click", () => (modalRoot.innerHTML = ""));
  document.getElementById("guideOverlay").addEventListener("click", (e) => {
    if (e.target.id === "guideOverlay") modalRoot.innerHTML = "";
  });
}

// ---------------- RENDER ----------------

function render() {
  if (!room) return;
  document.getElementById("roomTitle").textContent = room.name || "Kagemusha";

  const alivePlayers = room.players.filter((p) => p.alive);
  const currentPlayer = room.players[room.turnIndex];
  const isMyTurn = currentPlayer && currentPlayer.uid === myUid && room.status === "playing";

  document.getElementById("turnBanner").textContent =
    room.status === "finished"
      ? ""
      : currentPlayer
      ? (isMyTurn ? "Giliran kamu." : `Menunggu ${currentPlayer.name} beraksi...`)
      : "";

  renderPlayers(currentPlayer);
  renderHand();
  renderActionPanel(isMyTurn, currentPlayer);
  renderRespondPanel();
  renderLog();

  if (room.status === "finished") {
    renderWinner();
  }
}

function renderPlayers(currentPlayer) {
  const row = document.getElementById("playersRow");
  row.innerHTML = "";
  room.players.forEach((p) => {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    if (p.uid === myUid) chip.classList.add("me");
    if (currentPlayer && p.uid === currentPlayer.uid && room.status === "playing") chip.classList.add("current-turn");
    if (!p.alive) chip.classList.add("dead");

    const canTarget = pendingTargetAction && p.uid !== myUid && p.alive;
    if (canTarget) {
      chip.classList.add("targetable");
      chip.addEventListener("click", () => confirmTargetAndInitiate(pendingTargetAction, p.uid));
    }

    chip.innerHTML = `
      <div class="pname">${escapeHtml(p.name)}${p.uid === myUid ? " (kamu)" : ""}</div>
      <div class="pmeta">
        <span>${p.coins} koin</span>
        <span>${p.cardCount != null ? p.cardCount : 2} kartu</span>
      </div>
    `;
    row.appendChild(chip);
  });
}

function renderHand() {
  const handEl = document.getElementById("myHand");
  handEl.innerHTML = "";
  myCards.forEach((c) => {
    const div = document.createElement("div");
    div.innerHTML = roleCardHtml(c.role, { dead: !c.alive });
    handEl.appendChild(div.firstElementChild);
  });
}

function renderActionPanel(isMyTurn, currentPlayer) {
  const panel = document.getElementById("actionPanel");
  const grid = document.getElementById("actionGrid");
  const targetHint = document.getElementById("targetHint");
  grid.innerHTML = "";

  const blocked = room.status !== "playing" || !!room.pendingAction || !isMyTurn;
  panel.style.opacity = blocked ? "0.5" : "1";

  const myCoins = currentPlayer ? currentPlayer.coins : 0;
  const forceCoup = mustCoup(myCoins);

  Object.values(ACTIONS).forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "action-btn btn-secondary";
    const disabled = blocked || a.cost > myCoins || (forceCoup && a.id !== "coup");
    if (disabled) btn.classList.add("disabled");
    btn.innerHTML = `<span class="a-name">${a.name}</span><span class="a-cost">${a.cost ? a.cost + " koin" : "gratis"}${a.requiresRole ? " · " + ROLES[a.requiresRole].name : ""}</span>`;
    btn.addEventListener("click", () => {
      if (disabled) return;
      if (a.needsTarget) {
        pendingTargetAction = a.id;
        targetHint.style.display = "block";
        targetHint.textContent = `Pilih target untuk ${a.name} dengan tap salah satu pemain di atas.`;
        render();
      } else {
        initiateAction(a.id, null);
      }
    });
    grid.appendChild(btn);
  });

  if (!pendingTargetAction) targetHint.style.display = "none";
}

function confirmTargetAndInitiate(actionId, targetUid) {
  pendingTargetAction = null;
  initiateAction(actionId, targetUid);
}

function renderLog() {
  const box = document.getElementById("logBox");
  const log = room.log || [];
  box.innerHTML = log
    .slice(-30)
    .reverse()
    .map((l) => `<div>${escapeHtml(l.text)}</div>`)
    .join("");
}

function renderWinner() {
  const modalRoot = document.getElementById("modalRoot");
  const winner = room.players.find((p) => p.uid === room.winnerUid);
  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box" style="text-align:center;">
        <h2>${winner ? escapeHtml(winner.name) + " menang!" : "Permainan selesai"}</h2>
        <p>Terima kasih sudah bermain Kagemusha.</p>
        <button class="btn" id="backHomeBtn">Kembali ke beranda</button>
      </div>
    </div>
  `;
  document.getElementById("backHomeBtn").addEventListener("click", () => navigateTo("home.html"));
}

function renderRespondPanel() {
  const area = document.getElementById("respondArea");
  area.innerHTML = "";
  if (!room.pendingAction || room.status !== "playing") return;

  const pa = room.pendingAction;
  const action = ACTIONS[pa.action];
  const actor = room.players.find((p) => p.uid === pa.actorUid);
  const target = pa.targetUid ? room.players.find((p) => p.uid === pa.targetUid) : null;

  // Case: I must lose a card
  if (pa.mustLoseCardUid === myUid) {
    area.appendChild(buildLoseCardPanel(pa));
    return;
  }
  // Case: I must resolve a challenge against my claim (actor or blocker)
  if (pa.awaitingProofFrom === myUid) {
    area.appendChild(buildProofPanel(pa));
    return;
  }
  // Case: I must choose exchange cards
  if (pa.action === "exchange" && pa.exchangeOptionsFor === myUid) {
    area.appendChild(buildExchangePanel(pa));
    return;
  }

  // Otherwise: am I eligible to respond (pass/challenge/block) in current phase?
  const alreadyResponded = pa.responses && pa.responses[myUid];
  const iAmActor = pa.actorUid === myUid;
  const iAmAlive = room.players.find((p) => p.uid === myUid)?.alive;
  if (!iAmAlive || iAmActor || alreadyResponded) return;
  if (pa.mustLoseCardUid || pa.awaitingProofFrom) return; // someone else resolving

  const panel = document.createElement("div");
  panel.className = "respond-panel";

  if (pa.phase === "challenge_window") {
    panel.innerHTML = `
      <h3>${escapeHtml(actor?.name)} klaim aksi ${action.name}</h3>
      <p class="hint" style="margin:0;">Butuh kartu ${ROLES[action.requiresRole].name}. Percaya atau tantang?</p>
      <div class="btn-row">
        <button id="passBtn" class="btn-secondary">Percaya</button>
        <button id="challengeBtn">Tantang</button>
      </div>
    `;
  } else if (pa.phase === "block_window") {
    const isTargetOnly = action.id === "assassinate" || action.id === "steal";
    if (isTargetOnly && pa.targetUid !== myUid) return; // hanya target yang bisa block
    const blockRoles = action.blockableBy.map((r) => ROLES[r].name).join(" atau ");
    panel.innerHTML = `
      <h3>${escapeHtml(actor?.name)} melakukan ${action.name}${target ? " ke kamu" : ""}</h3>
      <p class="hint" style="margin:0;">Kamu bisa blok dengan klaim ${blockRoles}, atau biarkan saja.</p>
      <div class="btn-row" id="blockChoices"></div>
    `;
  } else if (pa.phase === "block_challenge_window") {
    const blocker = room.players.find((p) => p.uid === pa.blockedBy);
    panel.innerHTML = `
      <h3>${escapeHtml(blocker?.name)} blok dengan klaim ${ROLES[pa.blockClaimRole].name}</h3>
      <p class="hint" style="margin:0;">Percaya blok ini, atau tantang klaimnya?</p>
      <div class="btn-row">
        <button id="passBtn" class="btn-secondary">Percaya</button>
        <button id="challengeBtn">Tantang blok</button>
      </div>
    `;
  }

  area.appendChild(panel);

  const passBtn = document.getElementById("passBtn");
  if (passBtn) passBtn.addEventListener("click", respondPass);
  const challengeBtn = document.getElementById("challengeBtn");
  if (challengeBtn) challengeBtn.addEventListener("click", respondChallenge);

  const blockChoices = document.getElementById("blockChoices");
  if (blockChoices) {
    action.blockableBy.forEach((role) => {
      const b = document.createElement("button");
      b.textContent = `Blok (${ROLES[role].name})`;
      b.className = "btn-gold";
      b.style.margin = "0";
      b.addEventListener("click", () => respondBlock(role));
      blockChoices.appendChild(b);
    });
    const passB = document.createElement("button");
    passB.textContent = "Biarkan";
    passB.className = "btn-secondary";
    passB.style.margin = "0";
    passB.addEventListener("click", respondPass);
    blockChoices.appendChild(passB);
  }
}

function buildLoseCardPanel(pa) {
  const panel = document.createElement("div");
  panel.className = "respond-panel";
  const aliveCards = myCards.map((c, i) => ({ ...c, idx: i })).filter((c) => c.alive);
  panel.innerHTML = `
    <h3>Kamu harus gugurkan 1 kartu</h3>
    <p class="hint" style="margin:0 0 8px;">${pa.mustLoseCardReason === "challenge_succeeded" ? "Klaimmu terbukti bohong." : "Kamu kalah dalam aksi lawan."}</p>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;" id="loseCardChoices"></div>
  `;
  const choicesEl = panel.querySelector("#loseCardChoices");
  aliveCards.forEach((c) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = roleCardHtml(c.role);
    wrap.style.cursor = "pointer";
    wrap.addEventListener("click", () => loseCard(c.idx));
    choicesEl.appendChild(wrap.firstElementChild);
  });
  return panel;
}

function buildProofPanel(pa) {
  const panel = document.createElement("div");
  panel.className = "respond-panel";
  const requiredRole = pa.awaitingProofRole;
  const hasRole = myCards.some((c) => c.alive && c.role === requiredRole);
  panel.innerHTML = `
    <h3>Klaimmu ditantang!</h3>
    <p class="hint" style="margin:0 0 8px;">Kamu klaim punya ${ROLES[requiredRole].name}. Sistem akan cek otomatis kartumu.</p>
    <button id="revealBtn">${hasRole ? "Buktikan kartu" : "Lanjutkan"}</button>
  `;
  panel.querySelector("#revealBtn").addEventListener("click", () => resolveProof(pa));
  return panel;
}

function buildExchangePanel(pa) {
  const panel = document.createElement("div");
  panel.className = "respond-panel";
  panel.innerHTML = `
    <h3>Pilih kartu yang disimpan</h3>
    <p class="hint" style="margin:0 0 8px;">Pilih ${myCards.filter((c) => c.alive).length} kartu untuk disimpan dari pilihan berikut.</p>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px;" id="exchangeChoices"></div>
    <button id="confirmExchange" disabled style="margin-top:10px;">Konfirmasi</button>
  `;
  const keepCount = myCards.filter((c) => c.alive).length;
  const options = pa.exchangeOptions;
  const selected = [];
  const choicesEl = panel.querySelector("#exchangeChoices");
  options.forEach((role, i) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = roleCardHtml(role);
    wrap.style.cursor = "pointer";
    wrap.style.outline = "none";
    wrap.addEventListener("click", () => {
      const idx = selected.indexOf(i);
      if (idx >= 0) {
        selected.splice(idx, 1);
        wrap.firstElementChild.style.outline = "none";
      } else if (selected.length < keepCount) {
        selected.push(i);
        wrap.firstElementChild.style.outline = "3px solid var(--crimson)";
      }
      confirmBtn.disabled = selected.length !== keepCount;
    });
    choicesEl.appendChild(wrap.firstElementChild);
  });
  const confirmBtn = panel.querySelector("#confirmExchange");
  confirmBtn.addEventListener("click", () => {
    const keptRoles = selected.map((i) => options[i]);
    finishExchange(pa, keptRoles, options);
  });
  return panel;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------------- GAME ACTIONS (Firestore transactions) ----------------

const roomRef = () => doc(db, "rooms", roomCode);

async function initiateAction(actionId, targetUid) {
  const action = ACTIONS[actionId];
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef());
      const r = snap.data();
      const currentPlayer = r.players[r.turnIndex];
      if (currentPlayer.uid !== myUid) throw new Error("not-your-turn");
      if (r.pendingAction) throw new Error("action-in-progress");
      if (currentPlayer.coins < action.cost) throw new Error("not-enough-coins");
      if (mustCoup(currentPlayer.coins) && actionId !== "coup") throw new Error("must-coup");

      const players = r.players.map((p) =>
        p.uid === myUid ? { ...p, coins: p.coins - action.cost } : p
      );

      let logText = `${currentPlayer.name} melakukan ${action.name}`;
      const targetPlayer = targetUid ? r.players.find((p) => p.uid === targetUid) : null;
      if (targetPlayer) logText += ` ke ${targetPlayer.name}`;

      // Coup & income: langsung resolve tanpa window
      if (actionId === "income") {
        const idx2 = players.findIndex((p) => p.uid === myUid);
        players[idx2].coins += 1;
        tx.update(roomRef(), {
          players,
          pendingAction: null,
          turnIndex: nextTurnIndex(r, players),
          log: appendLog(r, `${currentPlayer.name} mengambil Income (+1 koin).`)
        });
        return;
      }

      if (actionId === "coup") {
        if (!targetUid) throw new Error("need-target");
        tx.update(roomRef(), {
          players,
          pendingAction: {
            action: "coup",
            actorUid: myUid,
            targetUid,
            phase: "resolving",
            mustLoseCardUid: targetUid,
            mustLoseCardReason: "coup",
            responses: {}
          },
          log: appendLog(r, `${logText}. ${targetPlayer.name} harus gugurkan kartu.`)
        });
        return;
      }

      // Aksi lain: mulai dengan challenge_window jika challengeable, else langsung block/resolve
      const phase = action.challengeable ? "challenge_window" : (action.blockableBy.length ? "block_window" : "resolving");

      const pendingAction = {
        action: actionId,
        actorUid: myUid,
        targetUid: targetUid || null,
        phase,
        responses: {},
        coinsAlreadyDeducted: action.cost
      };

      if (phase === "resolving") {
        // Tidak challengeable dan tidak blockable -> jarang terjadi, langsung resolve
        applyActionEffect(tx, r, players, pendingAction, logText);
        return;
      }

      tx.update(roomRef(), {
        players,
        pendingAction,
        log: appendLog(r, `${logText}. Menunggu respons pemain lain...`)
      });
    });
  } catch (err) {
    if (err.message !== "action-in-progress") {
      alert(friendlyError(err.message));
    }
  }
}

function friendlyError(code) {
  const map = {
    "not-your-turn": "Bukan giliranmu.",
    "not-enough-coins": "Koin tidak cukup.",
    "must-coup": "Koin >= 10, kamu wajib Coup.",
    "need-target": "Pilih target dulu."
  };
  return map[code] || "Aksi gagal, coba lagi.";
}

function nextTurnIndex(room, players) {
  const n = players.length;
  let idx = room.turnIndex;
  for (let i = 1; i <= n; i++) {
    const candidate = (idx + i) % n;
    if (players[candidate].alive) return candidate;
  }
  return room.turnIndex;
}

function appendLog(room, text) {
  const log = room.log || [];
  return [...log, { text, ts: Date.now() }].slice(-50);
}

async function respondPass() {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef());
    const r = snap.data();
    const pa = r.pendingAction;
    if (!pa) return;
    const responses = { ...(pa.responses || {}), [myUid]: "pass" };

    const eligibleCount = r.players.filter((p) => {
      if (!p.alive || p.uid === pa.actorUid) return false;
      if (pa.phase === "block_window") {
        const action = ACTIONS[pa.action];
        if ((pa.action === "assassinate" || pa.action === "steal") && pa.targetUid !== p.uid) return false;
      }
      return true;
    }).length;

    const passedCount = Object.values(responses).filter((v) => v === "pass").length;

    if (passedCount >= eligibleCount) {
      // Semua pass -> lanjut fase berikutnya
      advancePhaseAllPassed(tx, r, pa);
    } else {
      tx.update(roomRef(), { "pendingAction.responses": responses });
    }
  });
}

function advancePhaseAllPassed(tx, r, pa) {
  const action = ACTIONS[pa.action];
  const actor = r.players.find((p) => p.uid === pa.actorUid);

  if (pa.phase === "challenge_window") {
    if (action.blockableBy.length > 0) {
      tx.update(roomRef(), {
        pendingAction: { ...pa, phase: "block_window", responses: {} },
        log: appendLog(r, `Tidak ada yang menantang. Menunggu kemungkinan blok...`)
      });
    } else {
      applyActionEffect(tx, r, r.players, pa, `${actor.name} berhasil melakukan ${action.name}.`);
    }
    return;
  }

  if (pa.phase === "block_window") {
    applyActionEffect(tx, r, r.players, pa, `Tidak ada yang blok. ${actor.name} berhasil melakukan ${action.name}.`);
    return;
  }

  if (pa.phase === "block_challenge_window") {
    // Blok tidak ditantang -> blok berhasil, aksi asli dibatalkan
    tx.update(roomRef(), {
      players: r.players,
      pendingAction: null,
      turnIndex: nextTurnIndex(r, r.players),
      log: appendLog(r, `Blok berhasil, ${action.name} dibatalkan.`)
    });
  }
}

async function respondChallenge() {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef());
    const r = snap.data();
    const pa = r.pendingAction;
    if (!pa) return;

    if (pa.phase === "challenge_window") {
      tx.update(roomRef(), {
        pendingAction: {
          ...pa,
          awaitingProofFrom: pa.actorUid,
          awaitingProofRole: ACTIONS[pa.action].requiresRole,
          challengedBy: myUid
        },
        log: appendLog(r, `Klaim ditantang!`)
      });
    } else if (pa.phase === "block_challenge_window") {
      tx.update(roomRef(), {
        pendingAction: {
          ...pa,
          awaitingProofFrom: pa.blockedBy,
          awaitingProofRole: pa.blockClaimRole,
          blockChallengedBy: myUid
        },
        log: appendLog(r, `Klaim blok ditantang!`)
      });
    }
  });
}

async function respondBlock(role) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef());
    const r = snap.data();
    const pa = r.pendingAction;
    if (!pa || pa.phase !== "block_window") return;
    tx.update(roomRef(), {
      pendingAction: {
        ...pa,
        phase: "block_challenge_window",
        blockedBy: myUid,
        blockClaimRole: role,
        responses: {}
      },
      log: appendLog(r, `Blok diklaim dengan ${ROLES[role].name}.`)
    });
  });
}

async function resolveProof(pa) {
  const cardRef = doc(db, "rooms", roomCode, "privateCards", myUid);
  const cardSnap = await getDoc(cardRef);
  const cards = cardSnap.data().cards;
  const requiredRole = pa.awaitingProofRole;
  const matchIdx = cards.findIndex((c) => c.alive && c.role === requiredRole);
  const proven = matchIdx >= 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef());
    const r = snap.data();
    const currentPa = r.pendingAction;
    if (!currentPa) return;

    if (proven) {
      // Reshuffle & redraw kartu yang dibuktikan
      const newDeck = shuffle([...r.deck, cards[matchIdx].role]);
      const newRole = newDeck.pop();
      const newCards = cards.map((c, i) => (i === matchIdx ? { role: newRole, alive: true } : c));
      tx.set(cardRef, { cards: newCards });

      const loserUid = currentPa.challengedBy || currentPa.blockChallengedBy;
      const isBlockChallenge = !!currentPa.blockChallengedBy;

      tx.update(roomRef(), {
        deck: newDeck,
        pendingAction: {
          ...currentPa,
          awaitingProofFrom: null,
          awaitingProofRole: null,
          mustLoseCardUid: loserUid,
          mustLoseCardReason: "challenge_failed",
          proofOutcome: isBlockChallenge ? "block_proven" : "action_proven"
        },
        log: appendLog(r, `Klaim terbukti benar! Penantang harus gugurkan kartu.`)
      });
    } else {
      const isBlockChallenge = !!currentPa.blockChallengedBy;
      tx.update(roomRef(), {
        pendingAction: {
          ...currentPa,
          awaitingProofFrom: null,
          awaitingProofRole: null,
          mustLoseCardUid: myUid,
          mustLoseCardReason: "challenge_succeeded",
          proofOutcome: isBlockChallenge ? "block_failed" : "action_failed"
        },
        log: appendLog(r, `Klaim terbukti bohong! Harus gugurkan kartu.`)
      });
    }
  });
}

async function loseCard(cardIdx) {
  const cardRef = doc(db, "rooms", roomCode, "privateCards", myUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef());
    const r = snap.data();
    const pa = r.pendingAction;
    if (!pa || pa.mustLoseCardUid !== myUid) return;

    const cardSnap = await tx.get(cardRef);
    const cards = cardSnap.data().cards;
    const newCards = cards.map((c, i) => (i === cardIdx ? { ...c, alive: false } : c));
    tx.set(cardRef, { cards: newCards });

    const aliveCount = newCards.filter((c) => c.alive).length;
    let players = r.players.map((p) =>
      p.uid === myUid ? { ...p, cardCount: aliveCount, alive: aliveCount > 0 } : p
    );

    const alivePlayers = players.filter((p) => p.alive);
    if (alivePlayers.length <= 1) {
      tx.update(roomRef(), {
        players,
        pendingAction: null,
        status: "finished",
        winnerUid: alivePlayers[0]?.uid || null,
        log: appendLog(r, `${r.players.find((p) => p.uid === myUid).name} gugur total.`)
      });
      return;
    }

    // Lanjutkan alur berdasarkan konteks mustLoseCardReason
    const action = ACTIONS[pa.action];
    const actor = players.find((p) => p.uid === pa.actorUid);

    if (pa.mustLoseCardReason === "coup") {
      tx.update(roomRef(), {
        players,
        pendingAction: null,
        turnIndex: nextTurnIndex(r, players),
        log: appendLog(r, `Coup selesai.`)
      });
      return;
    }

    if (pa.mustLoseCardReason === "challenge_succeeded") {
      // Klaim bohong: aksi/blok gagal
      if (pa.proofOutcome === "block_failed") {
        // Blok gagal -> aksi asli lanjut jalan (efek diterapkan)
        applyActionEffect(tx, r, players, { ...pa, mustLoseCardUid: null }, `Blok gagal. ${action.name} tetap berjalan.`);
      } else {
        // Klaim aksi bohong -> aksi dibatalkan total
        tx.update(roomRef(), {
          players,
          pendingAction: null,
          turnIndex: nextTurnIndex(r, players),
          log: appendLog(r, `${action.name} dibatalkan karena bluff ketahuan.`)
        });
      }
      return;
    }

    if (pa.mustLoseCardReason === "challenge_failed") {
      // Penantang kalah, klaim asli terbukti benar
      if (pa.proofOutcome === "block_proven") {
        // Blok terbukti benar -> aksi asli dibatalkan
        tx.update(roomRef(), {
          players,
          pendingAction: null,
          turnIndex: nextTurnIndex(r, players),
          log: appendLog(r, `Blok terbukti sah. ${action.name} dibatalkan.`)
        });
      } else {
        // Klaim aksi terbukti benar -> lanjut ke block window / resolve
        if (action.blockableBy.length > 0) {
          tx.update(roomRef(), {
            players,
            pendingAction: { ...pa, phase: "block_window", responses: {}, mustLoseCardUid: null, mustLoseCardReason: null },
            log: appendLog(r, `Klaim terbukti benar. Menunggu kemungkinan blok...`)
          });
        } else {
          applyActionEffect(tx, r, players, { ...pa, mustLoseCardUid: null }, `Klaim terbukti benar. ${action.name} berjalan.`);
        }
      }
      return;
    }
  });
}

function applyActionEffect(tx, room, players, pa, logText) {
  const action = ACTIONS[pa.action];
  let newPlayers = [...players];
  let deck = room.deck;
  let finalLog = logText;
  let nextPending = null;

  const actorIdx = newPlayers.findIndex((p) => p.uid === pa.actorUid);
  const targetIdx = pa.targetUid ? newPlayers.findIndex((p) => p.uid === pa.targetUid) : -1;

  if (pa.action === "foreignAid") {
    newPlayers[actorIdx] = { ...newPlayers[actorIdx], coins: newPlayers[actorIdx].coins + 2 };
  } else if (pa.action === "tax") {
    newPlayers[actorIdx] = { ...newPlayers[actorIdx], coins: newPlayers[actorIdx].coins + 3 };
  } else if (pa.action === "steal") {
    const stealAmount = Math.min(2, newPlayers[targetIdx].coins);
    newPlayers[actorIdx] = { ...newPlayers[actorIdx], coins: newPlayers[actorIdx].coins + stealAmount };
    newPlayers[targetIdx] = { ...newPlayers[targetIdx], coins: newPlayers[targetIdx].coins - stealAmount };
  } else if (pa.action === "assassinate") {
    nextPending = {
      action: "assassinate",
      actorUid: pa.actorUid,
      targetUid: pa.targetUid,
      phase: "resolving",
      mustLoseCardUid: pa.targetUid,
      mustLoseCardReason: "coup",
      responses: {}
    };
  } else if (pa.action === "exchange") {
    const drawn = [deck.pop(), deck.pop()].filter(Boolean);
    nextPending = {
      action: "exchange",
      actorUid: pa.actorUid,
      phase: "resolving",
      exchangeOptionsFor: pa.actorUid,
      exchangeOptions: drawn,
      responses: {}
    };
  }

  const update = {
    players: newPlayers,
    deck,
    log: appendLog(room, finalLog)
  };

  if (nextPending) {
    update.pendingAction = nextPending;
  } else {
    update.pendingAction = null;
    update.turnIndex = nextTurnIndex(room, newPlayers);
  }

  tx.update(roomRef(), update);
}

async function finishExchange(pa, keptRoles, drawnOptions) {
  const cardRef = doc(db, "rooms", roomCode, "privateCards", myUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef());
    const r = snap.data();
    const currentCardSnap = await tx.get(cardRef);
    const currentCards = currentCardSnap.data().cards.filter((c) => c.alive);

    const newCards = keptRoles.map((role) => ({ role, alive: true }));
    tx.set(cardRef, { cards: newCards });

    // Kartu yang tidak dipilih (dari drawnOptions) kembali ke deck
    const returnedToDeck = drawnOptions.filter((role) => {
      const i = keptRoles.indexOf(role);
      if (i >= 0) {
        keptRoles.splice(i, 1);
        return false;
      }
      return true;
    });
    const newDeck = shuffle([...r.deck, ...returnedToDeck]);

    tx.update(roomRef(), {
      deck: newDeck,
      pendingAction: null,
      turnIndex: nextTurnIndex(r, r.players),
      log: appendLog(r, `Exchange selesai.`)
    });
  });
}
