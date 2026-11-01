import { useEffect, useRef, useState } from 'react';
import {
  Ambulance, Play, ChevronLeft, ChevronRight, Siren, Flashlight, Megaphone,
  Star, Sun, Moon, Music, Volume2, VolumeX,
} from 'lucide-react';
import { createGame } from './game/game';
import type { GameHandle } from './game/game';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [started, setStarted] = useState(false);
  const [stars, setStars] = useState(0);
  const [siren, setSiren] = useState(false);
  const [lights, setLights] = useState(false);
  const [night, setNight] = useState(false);
  const [music, setMusic] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = createGame(canvasRef.current, { onStars: (n) => setStars(n) });
    gameRef.current = g;
    return () => g.destroy();
  }, []);

  // блокируем контекстное меню и жесты браузера
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('gesturestart', prevent);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('gesturestart', prevent);
    };
  }, []);

  // клавиатура (удобно для проверки)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.code === 'ArrowLeft') g.input.left = true;
      if (e.code === 'ArrowRight') g.input.right = true;
      if (e.code === 'Space') { e.preventDefault(); g.setHorn(true); }
    };
    const up = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.code === 'ArrowLeft') g.input.left = false;
      if (e.code === 'ArrowRight') g.input.right = false;
      if (e.code === 'Space') g.setHorn(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const startGame = () => {
    const g = gameRef.current;
    if (!g) return;
    g.startAudio();
    if (music) g.setMusic(true);
    setStarted(true);
  };

  const hold = (fn: (v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
      fn(true);
    },
    onPointerUp: () => fn(false),
    onPointerCancel: () => fn(false),
    onLostPointerCapture: () => fn(false),
  });

  const tap = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      fn();
    },
  });

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#84cd55]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {started && (
        <>
          {/* Счётчик звёзд */}
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 shadow-lg backdrop-blur-sm">
            <Star className="h-7 w-7 fill-amber-400 text-amber-500" />
            <span key={stars} className="anim-star-bump text-2xl font-extrabold text-slate-700">
              {stars}
            </span>
          </div>

          {/* Настройки */}
          <div className="absolute right-4 top-4 flex gap-3">
            <button
              aria-label="День и ночь"
              className={`kid-btn h-14 w-14 rounded-full border-4 border-white shadow-lg backdrop-blur-sm flex items-center justify-center transition-colors ${night ? 'bg-indigo-500 text-amber-300' : 'bg-white/85 text-amber-500'}`}
              {...tap(() => { const v = gameRef.current?.toggleNight() ?? false; setNight(v); })}
            >
              {night ? <Moon className="h-7 w-7" /> : <Sun className="h-7 w-7" />}
            </button>
            <button
              aria-label="Музыка"
              className={`kid-btn h-14 w-14 rounded-full border-4 border-white shadow-lg backdrop-blur-sm flex items-center justify-center transition-colors ${music ? 'bg-white/85 text-pink-500' : 'bg-white/50 text-slate-400'}`}
              {...tap(() => { const v = !music; setMusic(v); gameRef.current?.setMusic(v); })}
            >
              <Music className="h-7 w-7" />
            </button>
            <button
              aria-label="Звук"
              className={`kid-btn h-14 w-14 rounded-full border-4 border-white shadow-lg backdrop-blur-sm flex items-center justify-center transition-colors ${sound ? 'bg-white/85 text-emerald-600' : 'bg-white/50 text-slate-400'}`}
              {...tap(() => { const v = !sound; setSound(v); gameRef.current?.setSound(v); })}
            >
              {sound ? <Volume2 className="h-7 w-7" /> : <VolumeX className="h-7 w-7" />}
            </button>
          </div>

          {/* Руль */}
          <div className="absolute bottom-5 left-5 flex gap-4">
            <button
              aria-label="Влево"
              className="kid-btn flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white/85 text-slate-700 shadow-xl backdrop-blur-sm sm:h-28 sm:w-28"
              {...hold((v) => { const g = gameRef.current; if (g) g.input.left = v; })}
            >
              <ChevronLeft className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={3} />
            </button>
            <button
              aria-label="Вправо"
              className="kid-btn flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white/85 text-slate-700 shadow-xl backdrop-blur-sm sm:h-28 sm:w-28"
              {...hold((v) => { const g = gameRef.current; if (g) g.input.right = v; })}
            >
              <ChevronRight className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={3} />
            </button>
          </div>

          {/* Действия */}
          <div className="absolute bottom-5 right-5 flex items-end gap-3 sm:gap-4 max-[560px]:flex-col">
            <button
              aria-label="Фары"
              className={`kid-btn flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-white shadow-xl sm:h-24 sm:w-24 ${lights ? 'active-glow bg-amber-400 text-amber-950' : 'bg-amber-300/90 text-amber-800'}`}
              {...tap(() => { const v = gameRef.current?.toggleLights() ?? false; setLights(v); })}
            >
              <Flashlight className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className="text-[11px] font-extrabold uppercase tracking-wide">Фары</span>
            </button>
            <button
              aria-label="Сигнал"
              className="kid-btn flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-white bg-emerald-400 text-emerald-950 shadow-xl sm:h-24 sm:w-24"
              {...hold((v) => gameRef.current?.setHorn(v))}
            >
              <Megaphone className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className="text-[11px] font-extrabold uppercase tracking-wide">Би-би!</span>
            </button>
            <button
              aria-label="Сирена"
              className={`kid-btn flex h-20 w-20 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-white bg-gradient-to-br from-rose-500 via-red-500 to-blue-500 text-white shadow-xl sm:h-24 sm:w-24 ${siren ? 'active-glow' : ''}`}
              {...tap(() => { const v = gameRef.current?.toggleSiren() ?? false; setSiren(v); })}
            >
              <Siren className="h-8 w-8 sm:h-9 sm:w-9" />
              <span className="text-[11px] font-extrabold uppercase tracking-wide">Сирена</span>
            </button>
          </div>
        </>
      )}

      {/* Стартовый экран */}
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-500/40 via-sky-400/25 to-emerald-500/30 backdrop-blur-[3px]">
          <div className="anim-pop mx-4 flex max-w-md flex-col items-center rounded-[36px] border-8 border-white bg-white/90 px-8 py-8 text-center shadow-2xl sm:px-12">
            <div className="relative -mt-20 mb-2 flex h-28 w-28 items-center justify-center rounded-full border-8 border-white bg-gradient-to-br from-rose-500 to-red-600 shadow-xl" style={{ animation: 'floaty 3s ease-in-out infinite' }}>
              <Ambulance className="h-14 w-14 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-slate-800">
              Скорая <span className="text-rose-500">помощь</span>
            </h1>
            <p className="mt-1 text-lg font-semibold text-slate-500">
              Весёлая поездка по большому городу
            </p>

            <div className="mt-5 flex gap-3">
              <div className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-sm font-bold text-rose-600">
                <Siren className="h-4 w-4" /> Мигалка
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-600">
                <Flashlight className="h-4 w-4" /> Фары
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-600">
                <Megaphone className="h-4 w-4" /> Би-би
              </div>
            </div>

            <button
              className="kid-btn mt-6 flex items-center gap-3 rounded-full border-4 border-white bg-gradient-to-br from-emerald-400 to-green-500 px-10 py-4 text-3xl font-extrabold text-white shadow-xl"
              onPointerDown={(e) => { e.preventDefault(); startGame(); }}
            >
              <Play className="h-9 w-9 fill-white" />
              ПОЕХАЛИ!
            </button>

            <p className="mt-4 max-w-xs text-sm font-semibold leading-snug text-slate-400">
              Машинка едет сама — просто поворачивай большими стрелками. Столкновений бояться не надо: машинки весело отлетают, как мячики!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
