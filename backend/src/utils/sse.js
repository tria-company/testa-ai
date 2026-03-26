export function initSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(':keepalive\n\n');
}

export function broadcast(session, eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  session.sseClients = session.sseClients.filter((client) => {
    try {
      client.write(payload);
      return true;
    } catch {
      return false;
    }
  });
}
