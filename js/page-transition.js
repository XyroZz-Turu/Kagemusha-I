// Shared page-transition helper - dipakai semua halaman
// Overlay hitam nutup layar 1 detik sebelum pindah halaman, dan fade-out 1 detik saat halaman baru muncul

function ensureOverlay() {
  let overlay = document.querySelector(".page-transition-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "page-transition-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

// Panggil sekali di awal tiap halaman - overlay hitam fade-out biar halaman baru "muncul"
export function initPageTransition() {
  const overlay = ensureOverlay();
  // paksa reflow dulu biar transition CSS kepakai, baru fade-out
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add("hide"));
  });
}

// Panggil ini menggantikan window.location.href = url secara langsung
export function navigateTo(url) {
  const overlay = ensureOverlay();
  overlay.classList.remove("hide");
  setTimeout(() => {
    window.location.href = url;
  }, 1000);
}
