"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (sticker) => {
    try {
        const client = sticker.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.stickerCreate?.enabled)
            return;
        console.log('Sticker Create Event Triggered:', sticker.name);
        const logChannelId = settings.logs.stickerCreate.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.stickerCreate;
        if (!locale) {
            console.error(`Failed to find sticker create locale data for ${client.defaultLanguage}`);
            return;
        }
        const auditLogs = await sticker.guild?.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.StickerCreate,
            limit: 1,
        });
        const createLog = auditLogs?.entries.first();
        const executor = createLog?.executor;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.stickerCreate.color)
            .setThumbnail(sticker.url)
            .addFields({
            name: `📝 ${locale.name}`,
            value: sticker.name || locale.unknown,
            inline: true
        }, {
            name: `📋 ${locale.description}`,
            value: sticker.description || locale.unknown,
            inline: true
        }, {
            name: `🏷️ ${locale.tags}`,
            value: sticker.tags || locale.unknown,
            inline: true
        }, {
            name: `📁 ${locale.format}`,
            value: sticker.format.toString(),
            inline: true
        }, {
            name: `✅ ${locale.available}`,
            value: sticker.available ? locale.yes : locale.no,
            inline: true
        }, {
            name: `👮 ${locale.createdBy}`,
            value: executor ? `${executor.tag} (<@${executor.id}>)` : locale.unknown,
            inline: true
        })
            .setFooter({ text: `${locale.stickerId}: ${sticker.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging sticker create:', error);
    }
};
