function createRetryableSender({ sock, store, baileys, logger }) {
  const { generateWAMessage, generateMessageIDV2, getUrlInfo, DEFAULT_CONNECTION_CONFIG } = baileys;
  const { linkPreviewImageThumbnailWidth, options } = DEFAULT_CONNECTION_CONFIG;

  // This application sends text and images. Generate them with the same options
  // as Baileys sendMessage, but persist before its first relay (not after upsert).
  return async (jid, content, messageLogId) => {
    const message = await generateWAMessage(jid, content, {
      logger,
      userJid: sock.user.id,
      messageId: generateMessageIDV2(sock.user.id),
      getUrlInfo: (text) => getUrlInfo(text, {
        thumbnailWidth: linkPreviewImageThumbnailWidth,
        fetchOpts: { timeout: 3000, ...options },
        logger
      }),
      getProfilePicUrl: sock.profilePictureUrl,
      upload: sock.waUploadToServer,
      options
    });

    // A failed write prevents sending a message that we cannot later recover.
    await store.saveMessage(message, messageLogId);
    await sock.relayMessage(jid, message.message, { messageId: message.key.id });

    // Preserve Baileys' own-message processing without delaying persistence.
    if (DEFAULT_CONNECTION_CONFIG.emitOwnEvents) {
      process.nextTick(() => {
        sock.processingMutex.mutex(() => sock.upsertMessage(message, "append"))
          .catch((err) => logger.error({ err }, "Processing outgoing WhatsApp message failed"));
      });
    }
    return message;
  };
}

module.exports = { createRetryableSender };
