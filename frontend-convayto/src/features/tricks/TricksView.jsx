import { useUi } from "../../contexts/UiContext";
import IconButton from "../../components/IconButton";
import { RiFlaskLine } from "react-icons/ri";

function TricksView() {
  const { closeTricksView } = useUi();

  return (
    <div className="fadeIn grid h-screen-safe grid-rows-[auto_1fr] bg-bgPrimary dark:bg-bgPrimary-dark">
      <div className="flex h-16 items-center justify-start gap-4 bg-LightShade/10 p-2">
        <IconButton onClick={closeTricksView}>
          <IconButton.Back />
        </IconButton>
        <RiFlaskLine className="text-xl text-bgAccent dark:text-bgAccent-dark" />
        <p className="select-none font-bold tracking-wider">Фокусы</p>
      </div>

      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-6xl">🧪</span>
        <p className="text-lg font-medium text-textPrimary dark:text-textPrimary-dark">
          Здесь скоро появятся фокусы
        </p>
        <p className="text-sm opacity-50">
          Экспериментальные функции в разработке
        </p>
      </div>
    </div>
  );
}

export default TricksView;
