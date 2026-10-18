import "./style.css";
import { Game } from "./game/Game";
import { loadTuningOverrides } from "./scene/tuning";

// Tuning overrides (URL or last session's harness values) have to be in
// place before the scene is built with them.
loadTuningOverrides();

const app = document.querySelector<HTMLDivElement>("#app")!;
new Game(app);
