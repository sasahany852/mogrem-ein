"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.data = void 0;
const discord_js_1 = require("discord.js");
const settings_json_1 = __importDefault(require('../../../settings.json'));
const permissionChecker_1 = require("../../utils/permissionChecker");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlocks a channel')
    .addChannelOption(option => option
    .setName('channel')
    .setDescription('The channel to unlock (current channel if not specified)')
    .setRequired(false))
    .addStringOption(option => option
    .setName('reason')
    .setDescription('The reason for unlocking')
    .setRequired(false));
const checkPermissions = (member) => {
    return (0, permissionChecker_1.checkCommandPermissions)(member, settings_json_1.default.commands?.unlock, discord_js_1.PermissionFlagsBits.ManageChannels);
};
const getLocale = (client, preferredLocale) => {
    let locale = client.locales.get(preferredLocale || client.defaultLanguage);
    if (!locale?.commands?.lock) {
        locale = client.locales.get(client.defaultLanguage);
    }
    if (!locale?.commands?.lock) {
        locale = client.locales.get('en');
    }
    if (!locale?.commands?.lock) {
        locale = {
            commands: {
                lock: {
                    title: "Channel Status Changed",
                    description: "Channel access has been modified",
                    success: "Channel unlocked successfully",
                    error: "Failed to unlock channel",
                    noPermission: "You do not have permission to use this command.",
                    botNoPermission: "I do not have permission to manage this channel.",
                    commandError: "An error occurred while executing the command.",
                    channelNotFound: "Channel not found",
                    invalidChannel: "Invalid channel type. Must be a text channel.",
                    alreadyLocked: "This channel is already locked",
                    alreadyUnlocked: "This channel is already unlocked",
                    requestedBy: "Requested by {user}",
                    reason: "Reason",
                    noReason: "No reason provided",
                    lockedBy: "Locked by {user}",
                    unlockedBy: "Unlocked by {user}",
                    channel: "Channel",
                    status: "Status",
                    locked: "🔒 Locked",
                    unlocked: "🔓 Unlocked"
                }
            }
        };
    }
    return locale;
};
exports.command = {
    name: 'unlock',
    aliases: settings_json_1.default.commands?.unlock?.aliases || [],
    enabled: settings_json_1.default.commands?.unlock?.enabled ?? true,
    execute: async (interaction, args, client) => {
        const isSlash = interaction instanceof discord_js_1.ChatInputCommandInteraction;
        const guild = isSlash ? interaction.guild : interaction.guild;
        const locale = getLocale(client, guild?.preferredLocale ?? null);
        try {
            const executingMember = isSlash ? interaction.member : interaction.member;
            if (!checkPermissions(executingMember)) {
                const noPermissionMessage = {
                    content: locale.commands.lock.noPermission,
                    flags: 1 << 6
                };
                if (isSlash) {
                    await interaction.reply(noPermissionMessage);
                }
                else {
                    await interaction.reply(noPermissionMessage.content);
                }
                return;
            }
            let targetChannel;
            let reason = null;
            if (isSlash) {
                const channel = interaction.options.getChannel('channel') || interaction.channel;
                reason = interaction.options.getString('reason');
                targetChannel = channel;
            }
            else {
                const channelMention = args[0]?.match(/^<#(\d+)>$/)?.[1];
                targetChannel = channelMention
                    ? guild?.channels.cache.get(channelMention)
                    : interaction.channel;
                reason = args.slice(channelMention ? 1 : 0).join(' ') || null;
            }
            if (!targetChannel || targetChannel.type !== discord_js_1.ChannelType.GuildText) {
                const reply = { content: locale.commands.lock.invalidChannel, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const currentPerms = targetChannel.permissionOverwrites.cache.get(guild.id);
            if (!currentPerms?.deny.has(discord_js_1.PermissionFlagsBits.SendMessages)) {
                const reply = { content: locale.commands.lock.alreadyUnlocked, flags: 1 << 6 };
                await (isSlash ? interaction.reply(reply) : interaction.reply(reply.content));
                return;
            }
            const formattedReason = `${executingMember.user.tag} | ${reason || locale.commands.lock.noReason}`;
            await targetChannel.permissionOverwrites.edit(guild.id, {
                SendMessages: null
            }, { reason: formattedReason });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(locale.commands.lock.title)
                .setDescription(locale.commands.lock.description)
                .setColor(0x00ff00)
                .addFields({
                name: `#️⃣ ${locale.commands.lock.channel}`,
                value: targetChannel.toString(),
                inline: true
            }, {
                name: `🔓 ${locale.commands.lock.status}`,
                value: locale.commands.lock.unlocked,
                inline: true
            }, {
                name: `📝 ${locale.commands.lock.reason}`,
                value: reason || locale.commands.lock.noReason,
                inline: false
            })
                .setFooter({
                text: locale.commands.lock.requestedBy.replace('{user}', isSlash ? interaction.user.tag : interaction.author.tag)
            })
                .setTimestamp();
            if (isSlash) {
                await interaction.reply({ embeds: [embed] });
            }
            else {
                await interaction.reply({ embeds: [embed] });
            }
        }
        catch (error) {
            console.error('Error executing unlock command:', error);
            const errorMessage = {
                content: locale.commands.lock.commandError,
                flags: 1 << 6
            };
            if (interaction instanceof discord_js_1.ChatInputCommandInteraction) {
                if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                }
                else {
                    await interaction.followUp(errorMessage);
                }
            }
            else {
                await interaction.reply(errorMessage.content);
            }
        }
    }
};
