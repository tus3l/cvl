import React, { useEffect, useRef, useState } from 'react';

// Simple timing mini-game: stop the scanner within the target window
// Returns a score 0-100 based on proximity to target
const MatrixMiniGame = ({ difficulty = 100, onComplete, onCancel }) => {
  const [running, setRunning] = useState(true);
  const [position, setPosition] = useState(0); // 0..100
  const [direction, setDirection] = useState(1);
  const [targetStart, setTargetStart] = useState(40);
  const [targetEnd, setTargetEnd] = useState(60);
  const rafRef = useRef(null);

  useEffect(() => {
    // Difficulty scales speed and target window
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const baseSpeed = 0.6; // percent per ms
    const speed = clamp(baseSpeed + (difficulty / 400), 0.6, 2.5);
    const windowSize = clamp(30 - Math.floor(difficulty / 10), 8, 30);
    const center = 50;
    setTargetStart(clamp(center - windowSize / 2, 5, 95));
    setTargetEnd(clamp(center + windowSize / 2, 5, 95));

    let lastTs = performance.now();
    const tick = (ts) => {
      const dt = ts - lastTs;
      lastTs = ts;
      setPosition((prev) => {
        let next = prev + direction * speed * (dt / 10);
        if (next >= 100) {
          next = 100;
          setDirection(-1);
        } else if (next <= 0) {
          next = 0;
          setDirection(1);
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty]);

  const stop = () => {
    setRunning(false);
    rafRef.current && cancelAnimationFrame(rafRef.current);
    // score based on proximity to middle of target
    const center = (targetStart + targetEnd) / 2;
    const dist = Math.abs(position - center);
    const maxDist = (targetEnd - targetStart) / 2;
    const score = Math.max(0, Math.round(100 * (1 - dist / Math.max(1, maxDist))));
    onComplete && onComplete(score);
  };

  return (
    <div className="mini-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="mini-card">
        <div className="mini-header">&gt;&gt; MATRIX_HACK</div>
        <div className="mini-body">
          <div className="bar">
            <div className="target" style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }} />
            <div className="scanner" style={{ left: `${position}%` }} />
          </div>
          <div className="mini-actions">
            <button className="mini-btn" onClick={stop} disabled={!running}>
              &gt; LOCK
            </button>
            <button className="mini-btn secondary" onClick={() => onCancel && onCancel()}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .mini-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index: 9999; }
        .mini-card { background: #0b0f10; border: 2px solid #0f0; border-radius: 8px; width: 520px; max-width: 92vw; box-shadow: 0 0 20px #0f0; }
        .mini-header { padding: 12px 16px; color: #2cfb4b; font-family: 'Orbitron', monospace; font-weight: 700; letter-spacing: 1px; }
        .mini-body { padding: 16px; }
        .bar { position: relative; height: 18px; background: #081108; border: 1px solid #2cfb4b; border-radius: 6px; overflow: hidden; }
        .target { position: absolute; top: 0; height: 100%; background: rgba(255,165,0,0.4); border-left: 1px solid #ffa500; border-right: 1px solid #ffa500; }
        .scanner { position: absolute; top: 0; height: 100%; width: 4px; background: #00e1ff; box-shadow: 0 0 8px #00e1ff; }
        .mini-actions { margin-top: 14px; display:flex; gap: 8px; }
        .mini-btn { padding: 8px 12px; background: #1a3f1a; color: #2cfb4b; border: 1px solid #2cfb4b; border-radius: 4px; cursor:pointer; }
        .mini-btn.secondary { background: #222; border-color: #999; color: #ddd; }
      `}</style>
    </div>
  );
};

export default MatrixMiniGame;
