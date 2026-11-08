// Keep the composer above the software keyboard: the visual viewport shrinks, the layout
// viewport does not, so a bar fixed to the bottom has to be lifted by the difference.
const composer = document.querySelector(".composer");
const lift = () => {
  const vv = window.visualViewport;
  if (!vv) return;
  composer.style.bottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`;
};
window.visualViewport?.addEventListener("resize", lift);
window.visualViewport?.addEventListener("scroll", lift);
