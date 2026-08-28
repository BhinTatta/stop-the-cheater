export interface WinResult {
  moves: number;
  timeSeconds: number;
}

export interface Overlay {
  rowButton: HTMLButtonElement;
  retryButton: HTMLButtonElement;
  setRowEnabled(enabled: boolean): void;
  showGameOver(): void;
  hideGameOver(): void;
  showWin(result: WinResult): void;
  hideWin(): void;
  getName(): string;
  onNameChange(cb: (name: string) => void): void;
  setShareAvailable(fileShareSupported: boolean): void;
  onShareClick(cb: () => void): void;
  onDownloadClick(cb: () => void): void;
  onCopyLinkClick(cb: () => void): void;
  flashCopied(): void;
  setPlayCount(n: number): void;
  showChallengeBanner(text: string, onDismiss: () => void): void;
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

  const playCountBadge = document.createElement("div");
  playCountBadge.id = "play-count-badge";
  playCountBadge.hidden = true;
  container.appendChild(playCountBadge);

  const challengeBanner = document.createElement("div");
  challengeBanner.id = "challenge-banner";
  const challengeText = document.createElement("p");
  challengeText.id = "challenge-text";
  const challengePlayButton = document.createElement("button");
  challengePlayButton.type = "button";
  challengePlayButton.textContent = "Play";
  challengeBanner.appendChild(challengeText);
  challengeBanner.appendChild(challengePlayButton);
  container.appendChild(challengeBanner);

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
  winPanel.innerHTML = `
    <p class="end-eyebrow">You Made It</p>
    <h2>YOU SAVED THEM</h2>
    <div class="win-stats">
      <span id="win-moves"></span>
      <span id="win-time"></span>
    </div>
    <input id="win-name-input" type="text" maxlength="20" placeholder="Enter your name (optional)" autocomplete="off" />
    <p id="win-sentence"></p>
    <div class="win-share-actions">
      <button id="win-share-btn" type="button">Share</button>
      <button id="win-download-btn" type="button">Download image</button>
      <button id="win-copy-btn" type="button">Copy link</button>
    </div>
  `;
  const winRetryButton = document.createElement("button");
  winRetryButton.type = "button";
  winRetryButton.textContent = "Play Again";
  winPanel.appendChild(winRetryButton);
  container.appendChild(winPanel);
  // Win screen retry routes through the same button so it isn't a dead end.
  winRetryButton.addEventListener("click", () => retryButton.click());

  const winMovesEl = winPanel.querySelector<HTMLSpanElement>("#win-moves")!;
  const winTimeEl = winPanel.querySelector<HTMLSpanElement>("#win-time")!;
  const nameInput = winPanel.querySelector<HTMLInputElement>("#win-name-input")!;
  const sentenceEl = winPanel.querySelector<HTMLParagraphElement>("#win-sentence")!;
  const shareBtn = winPanel.querySelector<HTMLButtonElement>("#win-share-btn")!;
  const downloadBtn = winPanel.querySelector<HTMLButtonElement>("#win-download-btn")!;
  const copyBtn = winPanel.querySelector<HTMLButtonElement>("#win-copy-btn")!;

  let currentResult: WinResult | null = null;
  let nameChangeTimer: number | undefined;

  function currentSentence(): string {
    const name = nameInput.value.trim().slice(0, 20);
    const moves = currentResult?.moves ?? 0;
    return name ? `${name} solved it in ${moves} moves.` : `I solved it in ${moves} moves.`;
  }

  function refreshSentence(): void {
    sentenceEl.textContent = currentSentence();
  }

  nameInput.addEventListener("input", () => {
    refreshSentence();
    if (nameChangeCb) {
      window.clearTimeout(nameChangeTimer);
      nameChangeTimer = window.setTimeout(() => nameChangeCb?.(nameInput.value), 250);
    }
  });

  let nameChangeCb: ((name: string) => void) | null = null;
  let shareCb: (() => void) | null = null;
  let downloadCb: (() => void) | null = null;
  let copyCb: (() => void) | null = null;

  shareBtn.addEventListener("click", () => shareCb?.());
  downloadBtn.addEventListener("click", () => downloadCb?.());
  copyBtn.addEventListener("click", () => copyCb?.());

  let dismissChallengeCb: (() => void) | null = null;
  challengePlayButton.addEventListener("click", () => {
    challengeBanner.classList.remove("visible");
    dismissChallengeCb?.();
  });

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
    showWin(result: WinResult) {
      currentResult = result;
      nameInput.value = "";
      winMovesEl.textContent = `${result.moves} moves`;
      winTimeEl.textContent = `${result.timeSeconds.toFixed(2)} seconds`;
      refreshSentence();
      winPanel.classList.add("visible");
    },
    hideWin() {
      winPanel.classList.remove("visible");
      currentResult = null;
    },
    getName() {
      return nameInput.value.trim().slice(0, 20);
    },
    onNameChange(cb) {
      nameChangeCb = cb;
    },
    setShareAvailable(fileShareSupported: boolean) {
      shareBtn.hidden = !fileShareSupported;
      downloadBtn.hidden = fileShareSupported;
      copyBtn.hidden = fileShareSupported;
    },
    onShareClick(cb) {
      shareCb = cb;
    },
    onDownloadClick(cb) {
      downloadCb = cb;
    },
    onCopyLinkClick(cb) {
      copyCb = cb;
    },
    flashCopied() {
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      window.setTimeout(() => {
        copyBtn.textContent = original;
      }, 1400);
    },
    setPlayCount(n: number) {
      playCountBadge.textContent = `${n.toLocaleString()} people have tried`;
      playCountBadge.hidden = false;
    },
    showChallengeBanner(text: string, onDismiss: () => void) {
      // `text` may embed an untrusted URL-supplied name — textContent only,
      // never innerHTML.
      challengeText.textContent = text;
      dismissChallengeCb = onDismiss;
      challengeBanner.classList.add("visible");
    },
  };
}
