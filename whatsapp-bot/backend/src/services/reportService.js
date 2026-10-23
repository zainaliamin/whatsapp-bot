const reportRepository = require("../repositories/reportRepository");
const clientRepository = require("../repositories/clientRepository");

async function getAdminReport() {
  const [totalMessages, messagesPerUser, messagesPerDay, activeClients, messageOverview] = await Promise.all([
    reportRepository.getTotalMessages(),
    reportRepository.getMessagesPerUser(),
    reportRepository.getMessagesPerDay(30),
    clientRepository.countActiveClients(),
    reportRepository.getMessageOverview()
  ]);

  return {
    totalMessages,
    activeClients,
    messageOverview,
    messagesPerUser,
    messagesPerDay
  };
}

module.exports = {
  getAdminReport
};
