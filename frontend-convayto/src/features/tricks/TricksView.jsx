import { useState } from "react";
import { useUi } from "../../contexts/UiContext";
import IconButton from "../../components/IconButton";
import { RiFlaskLine, RiGamepadLine } from "react-icons/ri";
import PacmanGame from "./PacmanGame";

function TricksView() {
  const { closeTricksView } = useUi();
  const [pacmanOpen, setPacmanOpen] = useState(false);

  return (
    <div className="fadeIn grid h-screen-safe grid-rows-[auto_1fr] bg-bgPrimary dark:bg-bgPrimary-dark">
      <div className="flex h-16 items-center justify-start gap-4 bg-LightShade/10 p-2">
        <IconButton onClick={closeTricksView}>
          <IconButton.Back />
        </IconButton>
        <RiFlaskLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
        <p className="select-none font-bold tracking-wider">Фокусы</p>
      </div>

      <div className="flex h-full flex-col items-start gap-3 overflow-auto p-4">
        <p className="mb-2 text-sm opacity-50">Экспериментальные функции</p>

        <button
          onClick={() => setPacmanOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-LightShade/10 px-4 py-3 text-left transition-colors hover:bg-LightShade/20 active:scale-[0.98]"
          data-testid="tricks-pacman-btn"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/20 text-xl">
            🟡
          </span>
          <div>
            <p className="font-semibold text-textPrimary dark:text-textPrimary-dark">Pacman</p>
            <p className="text-xs opacity-50">Классическая аркадная игра</p>
          </div>
          <RiGamepadLine className="ml-auto text-xl opacity-40" />
        </button>
      </div>

      {pacmanOpen && <PacmanGame onClose={() => setPacmanOpen(false)} />}
    </div>
  );
}

export default TricksView;
