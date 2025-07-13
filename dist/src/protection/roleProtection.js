"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRoleRemove = exports.handleRoleAdd = exports.handleRoleUpdate = exports.handleRoleDelete = exports.handleRoleCreate = void 0;
const discord_js_1 = require("discord.js");
const actionTracker = new Map();
const resetCounters = (userId, settings) => {
    const now = Date.now();
    const userData = actionTracker.get(userId);
    if (userData && now - userData.lastReset >= settings.protection.role.limits.timeWindow) {
        actionTracker.set(userId, {
            creates: 0,
            deletes: 0,
            updates: 0,
            adds: 0,
            removes: 0,
            lastReset: now
        });
    }
};
const takeAction = async (member, reason) => {
    const client = member.client;
    const settings = client.settings;
    const { action } = settings.protection.role;
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
const sendProtectionLog = async (client, member, actionType, roleName, limitType, limit) => {
    const settings = client.settings;
    try {
        if (!settings.protection?.logChannelId)
            return;
        const logChannel = member.guild.channels.cache.get(settings.protection.logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const locale = client.locales.get(client.defaultLanguage)?.protection.role;
        if (!locale)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setDescription(locale.description)
            .setColor(settings.protection.role.color)
            .addFields([
            {
                name: `👤 ${locale.member}`,
                value: `${member.user.tag} (<@${member.id}>)`,
                inline: true
            },
            {
                name: `📝 ${locale.roleName}`,
                value: roleName,
                inline: true
            },
            {
                name: `⚡ ${locale.actionType}`,
                value: locale.types[actionType],
                inline: true
            },
            {
                name: `🛡️ ${locale.action}`,
                value: locale.actions[settings.protection.role.action.type],
                inline: true
            },
            {
                name: `⏰ ${locale.timeWindow}`,
                value: `${settings.protection.role.limits.timeWindow / 1000} ${locale.seconds}`,
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
const handleRoleCreate = async (role) => {
    const client = role.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.role.enabled === false)
        return;
    try {
        const auditLogs = await role.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.RoleCreate,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const member = await role.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.creates++;
        if (userData.creates >= settings.protection.role.limits.createLimit) {
            await takeAction(member, settings.protection.role.action.reason);
            await sendProtectionLog(client, member, 'create', role.name, 'createLimit', settings.protection.role.limits.createLimit);
        }
    }
    catch (error) {
        console.error('Error in role create protection:', error);
    }
};
exports.handleRoleCreate = handleRoleCreate;
const handleRoleDelete = async (role) => {
    const client = role.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.role.enabled === false)
        return;
    try {
        const auditLogs = await role.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.RoleDelete,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const member = await role.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.deletes++;
        if (userData.deletes >= settings.protection.role.limits.deleteLimit) {
            await takeAction(member, settings.protection.role.action.reason);
            await sendProtectionLog(client, member, 'delete', role.name, 'deleteLimit', settings.protection.role.limits.deleteLimit);
        }
    }
    catch (error) {
        console.error('Error in role delete protection:', error);
    }
};
exports.handleRoleDelete = handleRoleDelete;
const handleRoleUpdate = async (oldRole, newRole) => {
    const client = oldRole.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.role.enabled === false)
        return;
    try {
        const hasNameChange = oldRole.name !== newRole.name;
        const hasColorChange = oldRole.color !== newRole.color;
        const hasPermissionChange = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
        const hasPositionChange = oldRole.position !== newRole.position;
        const hasHoistChange = oldRole.hoist !== newRole.hoist;
        const hasMentionableChange = oldRole.mentionable !== newRole.mentionable;
        if (!hasNameChange && !hasColorChange && !hasPermissionChange &&
            !hasPositionChange && !hasHoistChange && !hasMentionableChange) {
            return;
        }
        const auditLogs = await newRole.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.RoleUpdate,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const member = await newRole.guild.members.fetch(log.executor.id);
        if (member.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.updates++;
        if (userData.updates >= settings.protection.role.limits.updateLimit) {
            await takeAction(member, settings.protection.role.action.reason);
            await sendProtectionLog(client, member, 'update', newRole.name, 'updateLimit', settings.protection.role.limits.updateLimit);
        }
    }
    catch (error) {
        console.error('Error in role update protection:', error);
    }
};
exports.handleRoleUpdate = handleRoleUpdate;
const handleRoleAdd = async (member, role) => {
    const client = member.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.role.enabled === false)
        return;
    try {
        const auditLogs = await member.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberRoleUpdate,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const executor = await member.guild.members.fetch(log.executor.id);
        if (executor.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.adds++;
        if (userData.adds >= settings.protection.role.limits.addLimit) {
            await takeAction(executor, settings.protection.role.action.reason);
            await sendProtectionLog(client, executor, 'add', role.name, 'addLimit', settings.protection.role.limits.addLimit);
        }
    }
    catch (error) {
        console.error('Error in role add protection:', error);
    }
};
exports.handleRoleAdd = handleRoleAdd;
const handleRoleRemove = async (member, role) => {
    const client = member.client;
    const settings = client.settings;
    if (!settings.protection.enabled || !settings.protection.role.enabled === false)
        return;
    try {
        const auditLogs = await member.guild.fetchAuditLogs({
            type: discord_js_1.AuditLogEvent.MemberRoleUpdate,
            limit: 1
        });
        const log = auditLogs.entries.first();
        if (!log || !log.executor)
            return;
        const executor = await member.guild.members.fetch(log.executor.id);
        if (executor.roles.cache.some(r => settings.protection.role.action.ignoredRoles.includes(r.id)))
            return;
        resetCounters(log.executor.id, settings);
        let userData = actionTracker.get(log.executor.id);
        if (!userData) {
            userData = {
                creates: 0,
                deletes: 0,
                updates: 0,
                adds: 0,
                removes: 0,
                lastReset: Date.now()
            };
            actionTracker.set(log.executor.id, userData);
        }
        userData.removes++;
        if (userData.removes >= settings.protection.role.limits.removeLimit) {
            await takeAction(executor, settings.protection.role.action.reason);
            await sendProtectionLog(client, executor, 'remove', role.name, 'removeLimit', settings.protection.role.limits.removeLimit);
        }
    }
    catch (error) {
        console.error('Error in role remove protection:', error);
    }
};
exports.handleRoleRemove = handleRoleRemove;
