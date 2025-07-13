"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const formatDate_1 = require("../utils/formatDate");
exports.default = async (member) => {
    try {
        const client = member.client;
        const settings = client.settings;
        if (!settings.logs?.enabled || !settings.logs.memberLeave?.enabled)
            return;
        const logChannelId = settings.logs.memberLeave.channelId;
        if (!logChannelId)
            return;
        const logChannel = await client.channels.fetch(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.logs?.memberLeave;
        if (!locale) {
            console.error(`Failed to find member leave locale data for ${client.defaultLanguage}`);
            return;
        }
        const fullMember = member.partial ? await member.fetch() : member;
        const roles = fullMember.roles.cache
            .filter(role => role.id !== fullMember.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => `<@&${role.id}>`);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.logs.memberLeave.color)
            .setThumbnail(fullMember.user.displayAvatarURL({ size: 1024 }))
            .addFields({
            name: `👤 ${locale.member}`,
            value: `${fullMember.user.tag} (<@${fullMember.id}>)`,
            inline: true
        }, {
            name: `🤖 ${locale.bot}`,
            value: fullMember.user.bot ? locale.yes : locale.no,
            inline: true
        }, {
            name: `⌚ ${locale.joinedAt}`,
            value: (0, formatDate_1.formatDate)(fullMember.joinedAt),
            inline: true
        }, {
            name: `📅 ${locale.leftAt}`,
            value: (0, formatDate_1.formatDate)(new Date()),
            inline: true
        }, {
            name: `👥 ${locale.memberCount}`,
            value: (fullMember.guild.memberCount - 1).toString(),
            inline: true
        }, {
            name: `📋 ${locale.roles}`,
            value: roles.length > 0 ? roles.join(', ') : locale.noRoles,
            inline: false
        })
            .setFooter({ text: `${locale.memberId}: ${fullMember.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error logging member leave:', error);
    }
};
