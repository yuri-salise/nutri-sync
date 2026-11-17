import React, { useEffect, useRef, useState } from 'react';
import { Timer, X } from 'lucide-react';
import { Overlay } from '../common/Overlay';

interface RestTimerProps {
  endsAt: number;
  totalSec: number;
  onAdjust: (deltaSec: number) => void;
  onDismiss: () => void;
}

const beep = () => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not allowed: the vibration and on-screen message still fire */
  }
};

/** Sticky countdown that starts automatically after a set is ticked. */
export const RestTimer: React.FC<RestTimerProps> = ({ endsAt, totalSec, onAdjust, onDismiss }) => {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [endsAt]);

  // Lets other fixed UI (the Community button) move out of the timer's way.
  useEffect(() => {
    document.body.dataset.restTimer = '1';
    return () => {
      delete document.body.dataset.restTimer;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const finished = remaining === 0;

  useEffect(() => {
    if (finished && !firedRef.current) {
      firedRef.current = true;
      beep();
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* vibration unsupported */
      }
      const t = setTimeout(onDismiss, 4000);
      return () => clearTimeout(t);
    }
  }, [finished, onDismiss]);

  const pct = totalSec > 0 ? Math.min(100, ((totalSec - remaining) / totalSec) * 100) : 100;
  const mm = Math.floor(remaining / 60);
  const ss = (remaining % 60).toString().padStart(2, '0');

  return (
    <Overlay>
    <div
      role="timer"
      aria-live="polite"
      className="fixed left-0 right-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-64 z-40 px-4"
    >
      <div className="max-w-xl mx-auto rounded-2xl bg-[#12151b] border border-[#2a313f] shadow-2xl overflow-hidden">
        <div className="h-1 bg-[#1e232d]">
          <div className="h-full bg-[#C8FF00] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3 p-3">
          <Timer className={`h-5 w-5 shrink-0 ${finished ? 'text-[#00D26A]' : 'text-[#C8FF00]'}`} />
          <div className="flex-1 min-w-0">
            {finished ? (
              <p className="text-sm font-bold text-[#00D26A]">Rest’s over. Time for your next set!</p>
            ) : (
              <>
                <p className="text-xs text-[#848E9C]">Rest</p>
                <p className="text-xl font-black font-mono text-white leading-none">
                  {mm}:{ss}
                </p>
              </>
            )}
          </div>
          {!finished && (
            <>
              <button
                type="button"
                onClick={() => onAdjust(-15)}
                className="h-10 px-3 rounded-xl bg-[#07080a] border border-[#1e232d] text-sm font-semibold text-white"
              >
                −15s
              </button>
              <button
                type="button"
                onClick={() => onAdjust(15)}
                className="h-10 px-3 rounded-xl bg-[#07080a] border border-[#1e232d] text-sm font-semibold text-white"
              >
                +15s
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={finished ? 'Close' : 'Skip rest'}
            className="h-10 px-3 rounded-xl text-sm font-semibold text-[#848E9C] hover:text-white flex items-center gap-1"
          >
            {finished ? <X className="h-4 w-4" /> : 'Skip'}
          </button>
        </div>
      </div>
    </div>
    </Overlay>
  );
};
