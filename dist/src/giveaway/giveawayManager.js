"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGiveawayButtons = exports.handleGiveawayButton = exports.endGiveaway = exports.createGiveaway = void 0;
const discord_js_1 = require("discord.js");
const Giveaway_1 = require("../models/Giveaway");
const createGiveawayEmbed = (client, options, participants = []) => {
    const settings = client.settings.giveaway;
    const endsAt = Date.now() + options.duration;
    const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;
    if (!locale) {
        console.error(`Failed to find giveaway locale data for ${client.settings.defaultLanguage}`);
        return new discord_js_1.EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription('Giveaway information unavailable')
            .setColor('#FF0000');
    }
    const description = [
        `> 🎁 **${locale.prize}:** ${options.prize}`,
        `> 👑 **${locale.host}:** <@${options.hostId}>`,
        `> 👥 **${locale.winners}:** ${options.winners}`,
        `> ⏰ **${locale.ends}:** ${(0, discord_js_1.time)(new Date(endsAt), discord_js_1.TimestampStyles.RelativeTime)}`,
        `> 📊 **${locale.entries}:** ${participants.length}`,
        options.requirement ? `\n📝 **${locale.requirement}:**\n${options.requirement}` : '',
        '',
        locale.enterPrompt
    ].filter(Boolean).join('\n');
    return new discord_js_1.EmbedBuilder()
        .setTitle(locale.title.replace('{prize}', options.prize.toUpperCase()))
        .setDescription(description)
        .setColor(options.color || settings.embed.color)
        .setThumbnail(options.thumbnail || settings.embed.thumbnail)
        .setFooter({
        text: `${settings.embed.footer} • ${locale.endsAt}`,
        iconURL: client.user?.displayAvatarURL()
    })
        .setTimestamp(endsAt);
};
const createGiveawayButtons = (client, isHost = false) => {
    const settings = client.settings.giveaway;
    const locale = client.locales.get(client.settings.defaultLanguage || 'en')?.giveaway?.buttons;
    const rows = [];
    const mainRow = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel(locale?.enter || settings.buttons.enter)
        .setEmoji('🎉')
        .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
        .setCustomId('giveaway_leave')
        .setLabel(locale?.leave || settings.buttons.leave)
        .setEmoji('🚪')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    rows.push(mainRow);
    if (isHost) {
        const hostRow = new discord_js_1.ActionRowBuilder()
            .addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('giveaway_end')
            .setLabel(locale?.end || settings.buttons.end)
            .setEmoji('⏹️')
            .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
            .setCustomId('giveaway_reroll')
            .setLabel(locale?.reroll || settings.buttons.reroll)
            .setEmoji('🎲')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        rows.push(hostRow);
    }
    return rows;
};
exports.createGiveawayButtons = createGiveawayButtons;
const createEndedGiveawayEmbed = (client, giveaway, winners) => {
    const settings = client.settings.giveaway;
    const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;
    if (!locale)
        return new discord_js_1.EmbedBuilder();
    const winnerText = winners.length > 0
        ? winners.map(id => `> 👑 <@${id}>`).join('\n')
        : `> ❌ ${locale.noWinners}`;
    return new discord_js_1.EmbedBuilder()
        .setTitle(locale.endedTitle)
        .setDescription(`
        > 🎁 **${locale.prize}:** ${giveaway.prize}
        > 👤 **${locale.host}:** <@${giveaway.hostId}>
        > 📊 **${locale.totalEntries}:** ${giveaway.participants.length}
        
        **🏆 ${locale.winners}:**
        ${winnerText}
        
        ${winners.length > 0 ? locale.congratulations : locale.betterLuck}`)
        .setColor(settings.embed.color)
        .setThumbnail(settings.embed.thumbnail)
        .setFooter({
        text: `${settings.embed.footer} • ${locale.endsAt}`,
        iconURL: client.user?.displayAvatarURL()
    })
        .setTimestamp();
};
const createGiveaway = async (client, options) => {
    const embed = createGiveawayEmbed(client, options);
    const buttons = createGiveawayButtons(client, true);
    const message = await options.channel.send({
        embeds: [embed],
        components: buttons
    });
    const giveaway = await Giveaway_1.Giveaway.create({
        messageId: message.id,
        channelId: options.channel.id,
        guildId: options.channel.guildId,
        hostId: options.hostId,
        prize: options.prize,
        winners: options.winners,
        endsAt: new Date(Date.now() + options.duration),
        participants: []
    });
    setTimeout(() => (0, exports.endGiveaway)(client, giveaway), options.duration);
    return giveaway;
};
exports.createGiveaway = createGiveaway;
const endGiveaway = async (client, giveaway) => {
    try {
        if (giveaway.ended)
            return;
        const channel = await client.channels.fetch(giveaway.channelId);
        if (!channel)
            return;
        const message = await channel.messages.fetch(giveaway.messageId);
        if (!message)
            return;
        const freshGiveaway = await Giveaway_1.Giveaway.findById(giveaway._id);
        if (!freshGiveaway)
            return;
        const winners = freshGiveaway.participants.length > 0
            ? selectWinners(freshGiveaway.participants, freshGiveaway.winners)
            : [];
        freshGiveaway.ended = true;
        freshGiveaway.winnerIds = winners;
        await freshGiveaway.save();
        const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;
        if (!locale)
            return;
        await message.edit({
            embeds: [createEndedGiveawayEmbed(client, freshGiveaway, winners)],
            components: []
        });
        if (winners.length > 0) {
            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
            await channel.send({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle(locale.winnerAnnouncement.title)
                        .setDescription(locale.winnerAnnouncement.description
                        .replace('{winners}', winnerMentions)
                        .replace('{prize}', freshGiveaway.prize)
                        .replace('{host}', `<@${freshGiveaway.hostId}>`))
                        .setColor('#FFD700')
                        .setTimestamp()
                ],
                content: `${winnerMentions}`,
                allowedMentions: { users: winners }
            });
        }
    }
    catch (error) {
        console.error('Error ending giveaway:', error);
    }
};
exports.endGiveaway = endGiveaway;
const selectWinners = (participants, count) => {
    if (participants.length === 0)
        return [];
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(count, participants.length));
};
const handleGiveawayButton = async (interaction, client) => {
    try {
        const locale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.messages;
        if (!locale) {
            console.error(`Failed to find giveaway locale data for ${client.settings.defaultLanguage}`);
            await interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            });
            return;
        }
        const giveaway = await Giveaway_1.Giveaway.findOne({
            messageId: interaction.message.id,
            ended: false
        });
        if (!giveaway) {
            await interaction.reply({
                content: locale.endedOrDoesNotExist,
                ephemeral: true
            });
            return;
        }
        const userId = interaction.user.id;
        if (interaction.customId === 'giveaway_end' || interaction.customId === 'giveaway_reroll') {
            if (userId !== giveaway.hostId && !interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({
                    content: locale.onlyHostOrModerators,
                    ephemeral: true
                });
                return;
            }
            if (interaction.customId === 'giveaway_end') {
                await (0, exports.endGiveaway)(client, giveaway);
                await interaction.reply({
                    content: locale.endedSuccessfully,
                    ephemeral: true
                });
                return;
            }
            else {
                const newWinners = selectWinners(giveaway.participants, giveaway.winners);
                if (interaction.channel && 'send' in interaction.channel) {
                    await interaction.channel.send({
                        embeds: [createEndedGiveawayEmbed(client, giveaway, newWinners)],
                        content: `🎲 **${locale?.rerolledWinners || 'Rerolled Winners'}:** ${newWinners.map(id => `<@${id}>`).join(', ')}`
                    });
                }
                await interaction.reply({
                    content: locale.rerolledSuccessfully,
                    ephemeral: true
                });
                return;
            }
        }
        if (client.settings.giveaway.minimumAccountAge &&
            Date.now() - interaction.user.createdTimestamp < client.settings.giveaway.minimumAccountAge) {
            await interaction.reply({
                content: locale.accountAge,
                ephemeral: true
            });
            return;
        }
        if (client.settings.giveaway.minimumGuildAge && interaction.member) {
            const member = await interaction.guild?.members.fetch(userId);
            if (member && Date.now() - member.joinedTimestamp < client.settings.giveaway.minimumGuildAge) {
                await interaction.reply({
                    content: locale.guildAge,
                    ephemeral: true
                });
                return;
            }
        }
        if (interaction.customId === 'giveaway_enter') {
            if (!giveaway.participants.includes(userId)) {
                giveaway.participants.push(userId);
                await giveaway.save();
                await interaction.reply({
                    content: locale.entered,
                    ephemeral: true
                });
            }
            else {
                await interaction.reply({
                    content: locale.alreadyEntered,
                    ephemeral: true
                });
            }
        }
        else if (interaction.customId === 'giveaway_leave') {
            if (giveaway.participants.includes(userId)) {
                giveaway.participants = giveaway.participants.filter((id) => id !== userId);
                await giveaway.save();
                await interaction.reply({
                    content: locale.left,
                    ephemeral: true
                });
            }
            else {
                await interaction.reply({
                    content: locale.notEntered,
                    ephemeral: true
                });
            }
        }
        const message = interaction.message;
        const embed = discord_js_1.EmbedBuilder.from(message.embeds[0].toJSON());
        const embedLocale = client.locales.get(client.settings.defaultLanguage)?.giveaway?.embeds;
        const description = embed.data.description?.replace(new RegExp(`📊 \\*\\*${embedLocale?.entries || 'Entries'}:\\*\\* \\d+`), `📊 **${embedLocale?.entries || 'Entries'}:** ${giveaway.participants.length}`) || '';
        embed.setDescription(description);
        await message.edit({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error handling giveaway button:', error);
        const errorMessage = client.locales.get(client.settings.defaultLanguage)?.giveaway?.messages?.error
            || '❌ An error occurred while processing your request.';
        await interaction.reply({
            content: errorMessage,
            ephemeral: true
        });
    }
};
exports.handleGiveawayButton = handleGiveawayButton;
