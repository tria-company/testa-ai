import { config } from '../config.js';

export function requireAuth(req, res, next) {
  if (!config.apiKey) {
    return next();
  }

  // Aceita via header Authorization: Bearer <key> ou query param ?token=<key> (para SSE/EventSource)
  const header = req.headers.authorization;
  const token = req.query.token;

  const provided = (header && header.startsWith('Bearer ') && header.slice(7)) || token;

  if (!provided || provided !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized. Envie header Authorization: Bearer <TESTA_AI_API_KEY>.' });
  }

  next();
}
