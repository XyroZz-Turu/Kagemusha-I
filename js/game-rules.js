// Aturan & konstanta inti game Kagemusha (mekanisme identik Coup, nama role original)

export const ROLES = {
  daimyo: {
    id: "daimyo",
    name: "Daimyo",
    desc: "Ambil 3 koin (Tax). Bisa diblokir hanya oleh sesama Daimyo.",
    color: "amber"
  },
  ronin: {
    id: "ronin",
    name: "Ronin",
    desc: "Bayar 3 koin untuk menyingkirkan 1 kartu lawan (Assassinate). Diblokir oleh Miko.",
    color: "red"
  },
  kaizoku: {
    id: "kaizoku",
    name: "Kaizoku",
    desc: "Curi 2 koin dari pemain lain (Steal). Diblokir sesama Kaizoku atau Kitsune.",
    color: "teal"
  },
  kitsune: {
    id: "kitsune",
    name: "Kitsune",
    desc: "Tukar kartu dengan deck untuk lihat & pilih ulang (Exchange).",
    color: "purple"
  },
  miko: {
    id: "miko",
    name: "Miko",
    desc: "Bertahan dari Assassinate (Block). Tidak punya aksi menyerang sendiri.",
    color: "pink"
  }
};

export const ROLE_LIST = Object.keys(ROLES);

// Actions: type, cost, requiresRole (aksi karakter, null = aksi umum semua orang bisa),
// target (perlu pilih target atau tidak), blockableBy (list role yang bisa block)
export const ACTIONS = {
  income: {
    id: "income",
    name: "Income",
    desc: "Ambil 1 koin.",
    cost: 0,
    requiresRole: null,
    needsTarget: false,
    blockableBy: [],
    challengeable: false
  },
  foreignAid: {
    id: "foreignAid",
    name: "Foreign Aid",
    desc: "Ambil 2 koin.",
    cost: 0,
    requiresRole: null,
    needsTarget: false,
    blockableBy: ["daimyo"],
    challengeable: false
  },
  coup: {
    id: "coup",
    name: "Coup",
    desc: "Bayar 7 koin, paksa 1 pemain gugurkan kartu. Tidak bisa diblokir/challenge.",
    cost: 7,
    requiresRole: null,
    needsTarget: true,
    blockableBy: [],
    challengeable: false
  },
  tax: {
    id: "tax",
    name: "Tax",
    desc: "Ambil 3 koin.",
    cost: 0,
    requiresRole: "daimyo",
    needsTarget: false,
    blockableBy: [],
    challengeable: true
  },
  assassinate: {
    id: "assassinate",
    name: "Assassinate",
    desc: "Bayar 3 koin, paksa 1 pemain gugurkan kartu.",
    cost: 3,
    requiresRole: "ronin",
    needsTarget: true,
    blockableBy: ["miko"],
    challengeable: true
  },
  steal: {
    id: "steal",
    name: "Steal",
    desc: "Curi 2 koin dari pemain lain.",
    cost: 0,
    requiresRole: "kaizoku",
    needsTarget: true,
    blockableBy: ["kaizoku", "kitsune"],
    challengeable: true
  },
  exchange: {
    id: "exchange",
    name: "Exchange",
    desc: "Lihat 2 kartu dari deck, pilih kartu mana yang disimpan.",
    cost: 0,
    requiresRole: "kitsune",
    needsTarget: false,
    blockableBy: [],
    challengeable: true
  }
};

export function buildDeck() {
  const deck = [];
  ROLE_LIST.forEach((role) => {
    for (let i = 0; i < 3; i++) deck.push(role);
  });
  return shuffle(deck);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mustCoup(coins) {
  return coins >= 10;
}
