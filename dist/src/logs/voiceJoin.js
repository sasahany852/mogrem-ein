"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldState, newState) => {
    try {
        if (oldState.channelId !== null || !newState.channelId)
            return;
        const client = newState.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.voiceJoin?.enabled)
            return;
        const logChannelId = settings.logs.voiceJoin.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.voiceJoin;
        if (!locale) {
            console.error(`Failed to find voice join locale data for ${client.defaultLanguage}`);
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.voiceJoin.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${newState.member?.user.tag} (<@${newState.member?.id}>)`,
                inline: true
            },
            {
                name: `🔊 ${locale.channel}`,
                value: `${newState.channel?.name} (<#${newState.channelId}>)`,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.memberId}: ${newState.member?.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging voice join:', error);
    }
};
