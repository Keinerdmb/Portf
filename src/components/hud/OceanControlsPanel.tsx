import type { OceanParams } from '../../types/portfolio';
import { DEFAULT_OCEAN_PARAMS } from '../../utils/oceanMath';

interface OceanControlsPanelProps {
  params: OceanParams;
  onChange: (next: OceanParams) => void;
  onClose: () => void;
}

const PRESETS: { label: string; values: OceanParams }[] = [
  {
    label: 'Calma',
    values: {
      windSpeed: 5,
      currentAngle: 0.35,
      minWaveHeight: 0.15,
      maxWaveHeight: 0.45,
      waveFrequency: 0.65,
    },
  },
  {
    label: 'Suave',
    values: DEFAULT_OCEAN_PARAMS,
  },
  {
    label: 'Picado',
    values: {
      windSpeed: 18,
      currentAngle: 0.85,
      minWaveHeight: 0.6,
      maxWaveHeight: 1.55,
      waveFrequency: 1.15,
    },
  },
  {
    label: 'Tormenta',
    values: {
      windSpeed: 24,
      currentAngle: 1.4,
      minWaveHeight: 0.95,
      maxWaveHeight: 2.2,
      waveFrequency: 1.45,
    },
  },
];

export function OceanControlsPanel({
  params,
  onChange,
  onClose,
}: OceanControlsPanelProps) {
  const deg = Math.round(((params.currentAngle * 180) / Math.PI) % 360);

  return (
    <div className="pointer-events-auto absolute top-20 right-4 z-30 w-72 rounded-xl border border-amber-200/30 bg-slate-950/85 p-4 text-slate-100 shadow-2xl backdrop-blur-sm sm:right-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="font-mono text-xs font-semibold tracking-wider text-amber-300">
          GERSTNER // OLAS Y VIENTO
        </span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer font-mono text-xs text-slate-400 hover:text-amber-200"
        >
          ✕
        </button>
      </div>

      {/* Presets rápidos */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.values)}
            className="cursor-pointer rounded border border-white/15 bg-white/5 py-1 font-mono text-[10px] text-slate-200 transition hover:border-amber-300 hover:text-amber-200"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 font-mono text-[11px]">
        <label className="block">
          <div className="flex justify-between text-slate-300">
            <span>Viento</span>
            <span className="text-amber-200">{params.windSpeed.toFixed(0)} KT</span>
          </div>
          <input
            type="range"
            min={2}
            max={25}
            step={1}
            value={params.windSpeed}
            onChange={(e) =>
              onChange({ ...params, windSpeed: Number(e.target.value) })
            }
            className="mt-1 w-full accent-amber-300"
          />
        </label>

        <label className="block">
          <div className="flex justify-between text-slate-300">
            <span>Dirección corriente</span>
            <span className="text-amber-200">{deg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={6.28}
            step={0.05}
            value={params.currentAngle}
            onChange={(e) =>
              onChange({ ...params, currentAngle: Number(e.target.value) })
            }
            className="mt-1 w-full accent-amber-300"
          />
        </label>

        <label className="block">
          <div className="flex justify-between text-slate-300">
            <span>Altura mín. ola</span>
            <span className="text-sky-300">{params.minWaveHeight.toFixed(2)} m</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.2}
            step={0.05}
            value={params.minWaveHeight}
            onChange={(e) =>
              onChange({
                ...params,
                minWaveHeight: Number(e.target.value),
                maxWaveHeight: Math.max(params.maxWaveHeight, Number(e.target.value)),
              })
            }
            className="mt-1 w-full accent-sky-300"
          />
        </label>

        <label className="block">
          <div className="flex justify-between text-slate-300">
            <span>Altura máx. ola</span>
            <span className="text-sky-300">{params.maxWaveHeight.toFixed(2)} m</span>
          </div>
          <input
            type="range"
            min={0.35}
            max={2.4}
            step={0.05}
            value={params.maxWaveHeight}
            onChange={(e) =>
              onChange({
                ...params,
                maxWaveHeight: Number(e.target.value),
                minWaveHeight: Math.min(params.minWaveHeight, Number(e.target.value)),
              })
            }
            className="mt-1 w-full accent-sky-300"
          />
        </label>

        <label className="block">
          <div className="flex justify-between text-slate-300">
            <span>Frecuencia oleaje</span>
            <span className="text-emerald-300">{params.waveFrequency.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.45}
            max={1.6}
            step={0.05}
            value={params.waveFrequency}
            onChange={(e) =>
              onChange({ ...params, waveFrequency: Number(e.target.value) })
            }
            className="mt-1 w-full accent-emerald-300"
          />
        </label>
      </div>
    </div>
  );
}
