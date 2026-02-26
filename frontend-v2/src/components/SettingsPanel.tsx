// ═══════════════════════════════════════════════
//  Settings Panel
// ═══════════════════════════════════════════════
import { useStore } from '@/store';
import {
  ArrowLeft, Moon, Sun, Monitor, Bell, Shield, Palette,
  HelpCircle, Info, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { theme, setTheme } = useStore();

  const themeOptions: { value: typeof theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun size={18} />, label: 'Светлая' },
    { value: 'dark', icon: <Moon size={18} />, label: 'Тёмная' },
    { value: 'auto', icon: <Monitor size={18} />, label: 'Системная' },
  ];

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary)">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 bg-(--color-bg-surface) border-b border-(--color-separator) shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-bg-hover) cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-base font-semibold flex-1">Настройки</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Theme section */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-xs font-semibold uppercase text-(--color-text-tertiary) px-1 mb-2">
            <Palette size={14} className="inline mr-1.5 -mt-0.5" /> Тема оформления
          </h3>
          <div className="bg-(--color-bg-surface) rounded-xl overflow-hidden">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value);
                  window.dispatchEvent(new Event('theme-changed'));
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                  theme === opt.value ? 'bg-(--color-accent)/8' : 'hover:bg-(--color-bg-hover)'
                )}
              >
                <span className={cn(
                  theme === opt.value ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'
                )}>
                  {opt.icon}
                </span>
                <span className="text-sm flex-1 text-left">{opt.label}</span>
                {theme === opt.value && (
                  <div className="w-5 h-5 rounded-full bg-(--color-accent) flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Other settings */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-xs font-semibold uppercase text-(--color-text-tertiary) px-1 mb-2">
            Общие
          </h3>
          <div className="bg-(--color-bg-surface) rounded-xl overflow-hidden divide-y divide-(--color-separator)">
            <SettingsRow icon={<Bell size={18} />} label="Уведомления" />
            <SettingsRow icon={<Shield size={18} />} label="Конфиденциальность" />
            <SettingsRow icon={<HelpCircle size={18} />} label="Помощь" />
            <SettingsRow icon={<Info size={18} />} label="О приложении" subtitle="BarsikChat v2.0" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ icon, label, subtitle, onClick }: {
  icon: React.ReactNode; label: string; subtitle?: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-(--color-bg-hover) transition-colors cursor-pointer"
    >
      <span className="text-(--color-text-secondary)">{icon}</span>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm">{label}</p>
        {subtitle && <p className="text-xs text-(--color-text-tertiary)">{subtitle}</p>}
      </div>
      <ChevronRight size={16} className="text-(--color-text-tertiary)" />
    </button>
  );
}
