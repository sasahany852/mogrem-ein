"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (messages, channel) => {
    try {
        const client = messages.first()?.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.messageBulkDelete?.enabled)
            return;
        const firstMessage = messages.first();
        if (!firstMessage?.guild)
            return;
        const logChannelId = settings.logs.messageBulkDelete.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.messageBulkDelete;
        if (!locale) {
            console.error(`Failed to find message bulk delete locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await firstMessage.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MessageBulkDelete,
            limit: 1,
        });
        const deleteLog = auditLogs.entries.first();
        const executor = deleteLog?.executor;
        let fileContent = `Bulk Delete Log - ${new Date().toLocaleString()}\n`;
        fileContent += `Channel: #${channel.name} (${channel.id})\n`;
        fileContent += `Deleted by: ${executor ? `${executor.tag} (${executor.id})` : 'Unknown'}\n`;
        fileContent += `Total messages: ${messages.size}\n\n`;
        fileContent += '='.repeat(50) + '\n\n';
        const sortedMessages = Array.from(messages.values()).sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));
        sortedMessages.forEach(message => {
            const timestamp = message.createdAt?.toLocaleString() || 'Unknown Time';
            const author = message.author?.tag || 'Unknown Author';
            const authorId = message.author?.id || 'Unknown ID';
            const content = message.content || 'No content';
            const attachments = message.attachments.size ?
                `\nAttachments: ${message.attachments.map(a => a.url).join(', ')}` : '';
            fileContent += `[${timestamp}] ${author} (${authorId}):\n`;
            fileContent += `${content}${attachments}\n`;
            fileContent += '-'.repeat(50) + '\n';
        });
        const attachment = new discord_js_1.AttachmentBuilder(Buffer.from(fileContent, 'utf-8'), { name: `bulk-delete-${channel.name}-${new Date().getTime()}.txt` });
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.messageBulkDelete.color)
            .addFields([
            {
                name: `📝 ${locale.channel}`,
                value: `${channel} (<#${channel.id}>)`,
                inline: true
            },
            {
                name: `🔢 ${locale.messageCount}`,
                value: messages.size.toString(),
                inline: true
            },
            {
                name: `👮 ${locale.deletedBy}`,
                value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.channelId}: ${channel.id}` })
            .setTimestamp();
        await logChannel.send({
            embeds: [embed],
            files: [attachment]
        });
    }
    catch (error) {
        console.error('Error logging message bulk delete:', error);
    }
};
