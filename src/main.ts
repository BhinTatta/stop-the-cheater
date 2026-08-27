import "./style.css";
import { GameScene } from "./scene";

const app = document.querySelector<HTMLDivElement>("#app")!;
new GameScene(app);
