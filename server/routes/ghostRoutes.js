const express = require('express');
const router = express.Router();

// Access ghost engine via app.locals
router.get('/status', (req, res) => {
  try {
    const engine = req.app.locals.ghostEngine;
    if (!engine) return res.status(500).json({ ok: false, error: 'GhostEngine not initialized' });
    return res.json({ ok: true, running: engine.isRunning(), stats: engine.getStats() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/start', (req, res) => {
  try {
    const engine = req.app.locals.ghostEngine;
    if (!engine) return res.status(500).json({ ok: false, error: 'GhostEngine not initialized' });
    engine.start();
    return res.json({ ok: true, running: engine.isRunning() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/stop', (req, res) => {
  try {
    const engine = req.app.locals.ghostEngine;
    if (!engine) return res.status(500).json({ ok: false, error: 'GhostEngine not initialized' });
    engine.stop();
    return res.json({ ok: true, running: engine.isRunning() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
