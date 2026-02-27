import { useState } from "react";
import { RiCloseLine, RiAddLine, RiDeleteBinLine } from "react-icons/ri";

function PollCreationModal({ isOpen, onClose, onSubmit }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiChoice, setMultiChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  function addOption() {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  }

  function removeOption(idx) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  }

  function updateOption(idx, value) {
    const copy = [...options];
    copy[idx] = value;
    setOptions(copy);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimQ = question.trim();
    const trimOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!trimQ || trimOpts.length < 2) return;
    setSubmitting(true);
    try {
      await onSubmit({ question: trimQ, options: trimOpts, multiChoice, anonymous });
      setQuestion("");
      setOptions(["", ""]);
      setMultiChoice(false);
      setAnonymous(false);
      onClose();
    } catch {
      // handled upstream
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-2xl bg-bgPrimary p-6 shadow-2xl dark:bg-bgPrimary-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Создать опрос</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-LightShade/20">
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Вопрос"
            maxLength={300}
            className="w-full rounded-xl border border-LightShade/30 bg-transparent px-4 py-3 text-sm outline-none focus:border-bgAccent dark:border-LightShade/20"
          />

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`Вариант ${idx + 1}`}
                  maxLength={100}
                  className="flex-1 rounded-lg border border-LightShade/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-bgAccent dark:border-LightShade/20"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
                  >
                    <RiDeleteBinLine />
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-1 text-sm text-bgAccent hover:underline dark:text-bgAccent-dark"
              >
                <RiAddLine /> Добавить вариант
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={multiChoice} onChange={() => setMultiChoice(!multiChoice)} className="accent-bgAccent" />
              Мульти-выбор
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={anonymous} onChange={() => setAnonymous(!anonymous)} className="accent-bgAccent" />
              Анонимно
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || question.trim().length === 0 || options.filter((o) => o.trim()).length < 2}
            className="w-full rounded-xl bg-bgAccent py-3 text-sm font-semibold text-textPrimary-dark transition hover:bg-bgAccentDim active:scale-[0.98] disabled:opacity-50 dark:bg-bgAccent-dark dark:hover:bg-bgAccentDim-dark"
          >
            {submitting ? "Создание..." : "Создать опрос"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PollCreationModal;
