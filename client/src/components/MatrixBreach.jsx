import React, { useEffect, useMemo, useRef, useState } from 'react';

// Matrix Breach Mini-Game (Cyberpunk/Terminal Style)
// Props: cpuTier, firewallLevel, user, onSuccess(score), onFail()
const MatrixBreach = ({ cpuTier = 0, firewallLevel = 0, user = null, onSuccess, onFail }) => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Difficulty scaling
  const timeLimit = useMemo(() => clamp(5 + (cpuTier * 1.5) - (firewallLevel * 1.0), 2, 15), [cpuTier, firewallLevel]);
  const gridSide = useMemo(() => {
    if (firewallLevel >= 5) return 8;
    if (firewallLevel >= 3) return 6;
    return 4;
  }, [firewallLevel]);
  const sequenceLen = useMemo(() => (firewallLevel >= 3 ? 5 : 3), [firewallLevel]);
  const shuffleMs = useMemo(() => clamp(2000 - (firewallLevel * 200), 1000, 2200), [firewallLevel]);

  // Generate hex codes
  const randomHex = () => {
    const h = '0123456789ABCDEF';
    return h[Math.floor(Math.random() * 16)] + h[Math.floor(Math.random() * 16)];
  };

  const makeSequence = () => Array.from({ length: sequenceLen }, () => randomHex());

  // State
  const [targetSeq, setTargetSeq] = useState(makeSequence());
  const [grid, setGrid] = useState([]); // array of { code, isTarget, id }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [flash, setFlash] = useState(''); // '', 'red', 'green'
  const [ddosFrozen, setDdosFrozen] = useState(false);
  const [ddosFreezeProgress, setDdosFreezeProgress] = useState(0);

  const timerRef = useRef(null);
  const shuffleRef = useRef(null);
  const audioCtxRef = useRef(null);
  const ddosFreezeStartRef = useRef(null);

  // WebAudio beeps
  const beep = (freq = 660, ms = 80) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), ms);
    } catch {}
  };

  // Build grid and inject targets
  useEffect(() => {
    const total = gridSide * gridSide;
    const base = Array.from({ length: total }, () => ({ code: randomHex(), isTarget: false, id: Math.random().toString(36).slice(2) }));
    // choose distinct positions for target sequence
    const positions = new Set();
    while (positions.size < sequenceLen) {
      positions.add(Math.floor(Math.random() * total));
    }
    const posArr = Array.from(positions);
    const seq = makeSequence();
    posArr.forEach((p, i) => {
      base[p] = { code: seq[i], isTarget: true, id: 'T' + i };
    });
    setTargetSeq(seq);
    setGrid(base);
    setCurrentIndex(0);
    setTimeLeft(timeLimit);
  }, [gridSide, sequenceLen, timeLimit]);

  // Timer + progress
  useEffect(() => {
    const startedAt = performance.now();
    const isDDoSFrozen = user?.ddos_freeze_until && new Date(user.ddos_freeze_until) > new Date();
    
    // Debug logging
    console.log('=== MatrixBreach DDoS Check ===');
    console.log('User:', user?.username);
    console.log('ddos_freeze_until:', user?.ddos_freeze_until);
    console.log('Current time:', new Date().toISOString());
    console.log('isDDoSFrozen:', isDDoSFrozen);
    console.log('==============================');
    
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        // Calculate progress percentage
        const progPct = (prev / timeLimit) * 100;
        
        // Check if we should freeze at 50%
        if (isDDoSFrozen && progPct <= 50 && progPct > 45 && !ddosFrozen && !ddosFreezeStartRef.current) {
          // Trigger DDoS freeze
          setDdosFrozen(true);
          ddosFreezeStartRef.current = performance.now();
          beep(300, 200); // Warning beep
          return prev; // Don't decrease time
        }
        
        // If frozen, check if 1.5s passed
        if (ddosFrozen && ddosFreezeStartRef.current) {
          const elapsed = performance.now() - ddosFreezeStartRef.current;
          setDdosFreezeProgress(Math.min(100, (elapsed / 1500) * 100));
          
          if (elapsed >= 1500) {
            // Unfreeze
            setDdosFrozen(false);
            ddosFreezeStartRef.current = null;
            setDdosFreezeProgress(0);
          } else {
            return prev; // Stay frozen
          }
        }
        
        const next = prev - 0.1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          clearInterval(shuffleRef.current);
          setFlash('');
          onFail && onFail();
          return 0;
        }
        return next;
      });
    }, 100);

    // Shuffle wrong codes periodically
    shuffleRef.current && clearInterval(shuffleRef.current);
    shuffleRef.current = setInterval(() => {
      setGrid((prev) => prev.map((c) => (c.isTarget ? c : { ...c, code: randomHex() })));
    }, shuffleMs);

    return () => {
      timerRef.current && clearInterval(timerRef.current);
      shuffleRef.current && clearInterval(shuffleRef.current);
    };
  }, [shuffleMs, onFail, user, timeLimit]);

  const clickCode = (cell, idx) => {
    if (!grid.length) return;
    const need = targetSeq[currentIndex];
    if (cell.code === need && cell.isTarget) {
      beep(760, 90);
      setFlash('green');
      setTimeout(() => setFlash(''), 80);
      setCurrentIndex((i) => {
        const next = i + 1;
        if (next >= targetSeq.length) {
          // success score based on time remaining and accuracy (all correct)
          const score = clamp(Math.round(60 + (timeLeft / timeLimit) * 40), 0, 100);
          clearInterval(timerRef.current);
          clearInterval(shuffleRef.current);
          onSuccess && onSuccess(score);
        }
        return next;
      });
      // lock in: keep displaying the correct cell as confirmed (make it white/green)
      setGrid((prev) => prev.map((c, i2) => (i2 === idx ? { ...c, code: cell.code, isTarget: true } : c)));
    } else {
      // wrong click = penalty
      beep(220, 110);
      setFlash('red');
      setTimeout(() => setFlash(''), 120);
      setTimeLeft((prev) => Math.max(0, prev - 1.0));
    }
  };

  const progPct = clamp((timeLeft / timeLimit) * 100, 0, 100);
  const progColor = progPct > 60 ? '#17ff3a' : progPct > 30 ? '#ffea00' : '#ff3d3d';

  return (
    <div className="mb-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="mb-card">
        <div className="mb-header">&gt;&gt; MATRIX_BREACH</div>
        <div className="mb-top">
          <div className="seq-label">TARGET_SEQUENCE:</div>
          <div className="seq-list">
            {targetSeq.map((code, i) => (
              <span key={i} className={i < currentIndex ? 'seq-done' : i === currentIndex ? 'seq-active' : 'seq-pending'}>
                {code}
              </span>
            ))}
          </div>
        </div>
        <div className={`mb-grid ${flash === 'red' ? 'flash-red' : flash === 'green' ? 'flash-green' : ''}`} style={{
          gridTemplateColumns: `repeat(${gridSide}, 1fr)`
        }}>
          {grid.map((cell, idx) => (
            <button
              key={cell.id + '_' + idx}
              className={`mb-cell ${cell.isTarget ? 'cell-target' : 'cell-random'}`}
              onClick={() => clickCode(cell, idx)}
              onMouseEnter={() => beep(880, 20)}
            >
              {cell.code}
            </button>
          ))}
        </div>
        <div className="mb-timer" style={{ position: 'relative' }}>
          <div className="bar" style={{ width: `${progPct}%`, background: progColor }} />
          {ddosFrozen && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#ff0000',
              fontWeight: 'bold',
              fontSize: '0.85em',
              textShadow: '0 0 8px #ff0000',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              animation: 'ddosPulse 0.5s infinite'
            }}>
              <span style={{ fontSize: '1.2em' }}>⚠️</span>
              DDoS ATTACK
              <span style={{ fontSize: '1.2em' }}>⚠️</span>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .mb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index: 9999; }
        .mb-card { width: 720px; max-width: 95vw; background: #0a0d0e; border: 2px solid #17ff3a; box-shadow: 0 0 24px #17ff3a; border-radius: 10px; overflow: hidden; font-family: monospace; color: #aaf0c9; }
        .mb-header { padding: 12px 16px; color: #17ff3a; font-weight: 800; letter-spacing: 1px; }
        .mb-top { display:flex; gap: 12px; align-items:center; padding: 10px 16px; border-top: 1px solid #094b22; border-bottom: 1px solid #094b22; background: rgba(11,14,12,0.6); }
        .seq-label { color: #66ffa1; }
        .seq-list span { margin-right: 8px; padding: 4px 6px; border-radius: 4px; }
        .seq-active { color: #eaffff; border: 1px solid #17ff3a; box-shadow: 0 0 8px #17ff3a; }
        .seq-pending { color: #777; }
        .seq-done { color: #17ff3a; }
        .mb-grid { display:grid; gap: 8px; padding: 16px; background: #050706; position: relative; }
        .mb-grid.flash-red { animation: flashR 120ms linear; }
        .mb-grid.flash-green { animation: flashG 80ms linear; }
        @keyframes flashR { from { box-shadow: 0 0 14px #f00; } to { box-shadow: 0 0 0 #000; } }
        @keyframes flashG { from { box-shadow: 0 0 14px #17ff3a; } to { box-shadow: 0 0 0 #000; } }
        .mb-cell { background: #0a1410; border: 1px solid #145b34; color: #aaf0c9; padding: 10px; border-radius: 6px; cursor:pointer; transition: box-shadow 120ms, transform 120ms; }
        .mb-cell:hover { box-shadow: 0 0 12px #17ff3a; transform: translateY(-1px); }
        .cell-target { font-weight: 700; }
        .mb-timer { height: 10px; margin: 10px 16px 16px; background: #111; border: 1px solid #145b34; border-radius: 6px; overflow: visible; position: relative; }
        .bar { height: 100%; transition: width 100ms linear; }
        @keyframes ddosPulse { 0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.05); } }
      `}</style>
    </div>
  );
};

export default MatrixBreach;
