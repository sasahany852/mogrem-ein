"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChannelUpdate = exports.handleChannelDelete = exports.handleChannelCreate = void 0;
const discord_js_1 = require("discord.js");
const actionTracker = new Map();
const resetCounters = (userId, settings) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.channel.limits.timeWindow) {
        actionTracker.set(userId, {
            creates: 0,
            deletes: 0,
            updates: 0,
            lastReset: now
        });
    }
};
const takeAction = async (member, reason) => {
    const client = member.client;
    const settings = client.settings;
    const { action } = settings.protection.channel;
    try {
        switch (action.type) {
            case 'removeRoles':
                const roles = member.roles.cache.filter(role => !action.ignoredRoles.includes(role.id));
                await member.roles.remove(roles, reason);
                break;
            case 'kick':
                await member.kick(reason);
                break;
            case 'ban':
                await member.ban({
                    reason,
                    deleteMessageSeconds: action.duration || undefined
                });
                break;
        }
    }
    catch (error) {
        console.error('Error taking protection action:', error);
    }
};
const sendProtectionLog = async (client, member, actionType, channelName, limitType, limit) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId)
            return;
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.protection.channel;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.protection.channel.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${member.user.tag} (<@${member.id}>)`,
                inline: true
            },
            {
                name: `📝 ${locale.channelName}`,
                value: channelName,
                inline: true
            },
            {
                name: `⚡ ${locale.actionType}`,
                value: locale.types[actionType],
                inline: true
            },
            {
                name: `🛡️ ${locale.action}`,
                value: locale.actions[settings.protection.channel.action.type],
                inline: true
            },
            {
                name: `⏰ ${locale.timeWindow}`,
                value: `${settings.protection.channel.limits.timeWindow / 1000} ${locale.seconds}`,
                inline: true
            },
            {
                name: `📊 ${locale.limit}`,
                value: `${locale[limitType]}: ${limit}`,
                inline: true
            }
        ])
            .setFooter({ text: `${locale.memberId}: ${member.id}` })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error sending protection log:', error);
    }
};
const handleChannelCreate = async (channel) => {
    const client = channel.client;
    const settings = client.settings;
    if (!settings.protection.enabled || settings.protection.channel.enabled === false)
        return;
    if (!('guild' in channel))
        return;
    try {
        const auditLogs = await channel.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ChannelCreate,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const member = await channel.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(role => settings.protection.channel.action.ignoredRoles.includes(role.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.creates++;
        if (userData.creates >= settings.protection.channel.limits.createLimit) {
            await takeAction(member, settings.protection.channel.action.reason);
            await sendProtectionLog(client, member, 'create', channel.name, 'createLimit', settings.protection.channel.limits.createLimit);
        }
    }
    catch (error) {
        console.error('Error in channel create protection:', error);
    }
};
exports.handleChannelCreate = handleChannelCreate;
const handleChannelDelete = async (channel) => {
    const client = channel.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.channel.enabled)
        return;
    if (!('guild' in channel))
        return;
    try {
        const auditLogs = await channel.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ChannelDelete,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const member = await channel.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(role => settings.protection.channel.action.ignoredRoles.includes(role.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.deletes++;
        if (userData.deletes >= settings.protection.channel.limits.deleteLimit) {
            await takeAction(member, settings.protection.channel.action.reason);
            await sendProtectionLog(client, member, 'delete', channel.name, 'deleteLimit', settings.protection.channel.limits.deleteLimit);
        }
    }
    catch (error) {
        console.error('Error in channel delete protection:', error);
    }
};
exports.handleChannelDelete = handleChannelDelete;
const handleChannelUpdate = async (oldChannel, newChannel) => {
    const client = oldChannel.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.channel.enabled)
        return;
    if (!('guild' in oldChannel) || !('guild' in newChannel))
        return;
    try {
        const auditLogs = await newChannel.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.ChannelUpdate,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const member = await newChannel.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(role => settings.protection.channel.action.ignoredRoles.includes(role.id)))
            return;
        const hasNameChange = oldChannel.name !== newChannel.name;
        const hasPermissionChange = JSON.stringify(oldChannel.permissionOverwrites.cache) !==
            JSON.stringify(newChannel.permissionOverwrites.cache);
        const hasTypeChange = oldChannel.type !== newChannel.type;
        const hasTopicChange = 'topic' in oldChannel && 'topic' in newChannel &&
            oldChannel.topic !== newChannel.topic;
        if (!hasNameChange && !hasPermissionChange && !hasTypeChange && !hasTopicChange)
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.updates++;
        if (userData.updates >= settings.protection.channel.limits.updateLimit) {
            await takeAction(member, settings.protection.channel.action.reason);
            await sendProtectionLog(client, member, 'update', newChannel.name, 'updateLimit', settings.protection.channel.limits.updateLimit);
        }
    }
    catch (error) {
        console.error('Error in channel update protection:', error);
    }
};
exports.handleChannelUpdate = handleChannelUpdate;
