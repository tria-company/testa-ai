import { generateReport as generateReportViaAI } from './openai.service.js';

export async function generate(session) {
  const report = await generateReportViaAI(
    session.config.openaiApiKey,
    session.config.agentPrompt,
    session.persona,
    session.conversation
  );

  report.testMetadata = {
    sessionId: session.id,
    agentNumber: session.config.agentWhatsappNumber,
    totalMessagesSent: session.config.messageCount,
    totalMessagesReceived: session.conversation.filter((m) => m.role === 'agent').length,
    testDuration: Date.now() - session.createdAt,
    completedAt: new Date().toISOString(),
  };

  return report;
}
