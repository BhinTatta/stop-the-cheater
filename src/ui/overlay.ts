export interface Overlay {
  rowButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  setRowEnabled(enabled: boolean): void;
  showGameOver(): void;
  hideGameOver(): void;
  showWin(): void;
  hideWin(): void;
}

function paddleIconSvg(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 19 L13 11"></path>
    <path d="M11 7 L17 13 L13 17 L7 11 Z"></path>
  </svg>`;
}

export function createOverlay(container: HTMLElement): Overlay {
  const rowButton = document.createElement("button");
  rowButton.id = "row-btn";
  rowButton.type = "button";
  rowButton.setAttribute("aria-label", "Row the boat across");
  rowButton.innerHTML = `${paddleIconSvg()}<span>Row</span>`;
  container.appendChild(rowButton);

  const gameOverPanel = document.createElement("div");
  gameOverPanel.id = "gameover-panel";
  gameOverPanel.className = "end-panel";
  const retryButton = document.createElement("button");
  retryButton.id = "retry-btn";
  retryButton.type = "button";
  retryButton.textContent = "Retry";
  gameOverPanel.innerHTML = `
    <p class="end-eyebrow">Game Over</p>
    <h2>Couldn't Stop the Cheater!</h2>
  `;
  gameOverPanel.appendChild(retryButton);
  container.appendChild(gameOverPanel);

  const winPanel = document.createElement("div");
  winPanel.id = "win-panel";
  winPanel.className = "end-panel end-panel--win";
  const winRetryButton = document.createElement("button");
  winRetryButton.type = "button";
  winRetryButton.textContent = "Play Again";
  winPanel.innerHTML = `
    <p class="end-eyebrow">You Made It</p>
    <h2>Everyone Crossed Safely!</h2>
  `;
  winPanel.appendChild(winRetryButton);
  container.appendChild(winPanel);
  // Win screen is a placeholder for now (real design comes later) — route
  // its retry through the same button so it isn't a dead end.
  winRetryButton.addEventListener("click", () => retryButton.click());

  return {
    rowButton,
    retryButton,
    setRowEnabled(enabled: boolean) {
      rowButton.classList.toggle("enabled", enabled);
      rowButton.disabled = !enabled;
    },
    showGameOver() {
      gameOverPanel.classList.add("visible");
    },
    hideGameOver() {
      gameOverPanel.classList.remove("visible");
    },
    showWin() {
      winPanel.classList.add("visible");
    },
    hideWin() {
      winPanel.classList.remove("visible");
    },
  };
}
