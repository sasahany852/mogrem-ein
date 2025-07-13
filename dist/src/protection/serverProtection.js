"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleServerUpdate = void 0;
const discord_js_1 = require("discord.js");
const actionTracker = new Map();
const resetCounters = (userId, settings) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.server.limits.timeWindow) {
        actionTracker.set(userId, {
            updates: 0,
            lastReset: now
        });
    }
};
const takeAction = async (member, reason) => {
    const client = member.client;
    const settings = client.settings;
    const { action } = settings.protection.server;
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
const getChanges = (oldGuild, newGuild, client) => {
    const locale = client.locales.get(client.defaultLanguage)?.protection.server.types;
    const changes = [];
    if (oldGuild.name !== newGuild.name)
        changes.push(locale.name);
    if (oldGuild.icon !== newGuild.icon)
        changes.push(locale.icon);
    if (oldGuild.banner !== newGuild.banner)
        changes.push(locale.banner);
    if (oldGuild.splash !== newGuild.splash)
        changes.push(locale.splash);
    if (oldGuild.description !== newGuild.description)
        changes.push(locale.description);
    if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications)
        changes.push(locale.defaultNotifications);
    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter)
        changes.push(locale.explicitContentFilter);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel)
        changes.push(locale.verificationLevel);
    if (oldGuild.afkChannelId !== newGuild.afkChannelId)
        changes.push(locale.afkChannel);
    if (oldGuild.afkTimeout !== newGuild.afkTimeout)
        changes.push(locale.afkTimeout);
    if (oldGuild.systemChannelId !== newGuild.systemChannelId)
        changes.push(locale.systemChannel);
    if (oldGuild.rulesChannelId !== newGuild.rulesChannelId)
        changes.push(locale.rulesChannel);
    if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId)
        changes.push(locale.publicUpdatesChannel);
    if (oldGuild.preferredLocale !== newGuild.preferredLocale)
        changes.push(locale.preferredLocale);
    if (oldGuild.premiumProgressBarEnabled !== newGuild.premiumProgressBarEnabled)
        changes.push(locale.premiumProgressBarEnabled);
    return changes;
};
const sendProtectionLog = async (client, member, changes) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId)
            return;
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.protection.server;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.protection.server.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${member.user.tag} (<@${member.id}>)`,
                inline: true
            },
            {
                name: `📝 ${locale.changes}`,
                value: changes.join('\n'),
                inline: true
            },
            {
                name: `🛡️ ${locale.action}`,
                value: locale.actions[settings.protection.server.action.type],
                inline: true
            },
            {
                name: `⏰ ${locale.timeWindow}`,
                value: `${settings.protection.server.limits.timeWindow / 1000} ${locale.seconds}`,
                inline: true
            },
            {
                name: `📊 ${locale.limit}`,
                value: `${locale.updateLimit}: ${settings.protection.server.limits.updateLimit}`,
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
const handleServerUpdate = async (oldGuild, newGuild, executor) => {
    const client = oldGuild.client;
    const settings = client.settings;
    if (!settings.protection.enabled || settings.protection.server.enabled === false)
        return;
    try {
        if (executor.roles.cache.some(role => settings.protection.server.action.ignoredRoles.includes(role.id)))
            return;
        const changes = getChanges(oldGuild, newGuild, client);
        if (changes.length === 0)
            return;
        resetCounters(executor.id, settings);
        let userData = actionTracker.get(executor.id);
        if (!userData) {
            userData = {
                updates: 0,
                lastReset: Date.now()
            };
            actionTracker.set(executor.id, userData);
        }
        userData.updates++;
        if (userData.updates >= settings.protection.server.limits.updateLimit) {
            await takeAction(executor, settings.protection.server.action.reason);
            await sendProtectionLog(client, executor, changes);
        }
    }
    catch (error) {
        console.error('Error in server update protection:', error);
    }
};
exports.handleServerUpdate = handleServerUpdate;
