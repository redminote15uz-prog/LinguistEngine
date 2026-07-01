import { Trees, Laptop, Heart, Plane, Clock, LucideIcon } from 'lucide-react';
import { PRESETS } from '../data/presets';
import { PresetCategory } from '../types';

interface PresettedWordsProps {
  onSelectPreset: (words: string[]) => void;
  selectedPresetId: string | null;
}

const iconMap: Record<string, LucideIcon> = {
  Trees: Trees,
  Laptop: Laptop,
  Heart: Heart,
  Plane: Plane,
  Clock: Clock,
};

export default function PresettedWords({ onSelectPreset, selectedPresetId }: PresettedWordsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Or Quick Presets
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {PRESETS.map((preset) => {
          const Icon = iconMap[preset.icon] || Trees;
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset.words)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50/80 border-indigo-400 text-indigo-700 shadow-sm dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-indigo-900/50 dark:hover:bg-indigo-950/10'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className="text-xs font-medium truncate w-full">{preset.name}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate w-full">
                {preset.words.slice(0, 3).join(', ')}...
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
