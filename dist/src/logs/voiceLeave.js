"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
exports.default = async (oldState, newState) => {
    try {
        if (!oldState.channelId || newState.channelId !== null)
            return;
        const client = oldState.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.voiceLeave?.enabled)
            return;
        const logChannelId = settings.logs.voiceLeave.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.voiceLeave;
        if (!locale) {
            console.error(`Failed to find voice leave locale data for ${client.defaultLanguage}`);
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.voiceLeave.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${oldState.member?.user.tag} (<@${oldState.member?.id}>)`,
                inline: true
            },
            {
                name: `🔊 ${locale.channel}`,
                value: `${oldState.channel?.name} (<#${oldState.channelId}>)`,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.memberId}: ${oldState.member?.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging voice leave:', error);
    }
};
