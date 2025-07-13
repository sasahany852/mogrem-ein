"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketManager = void 0;
const discord_js_1 = require("discord.js");
const Ticket_1 = require("../models/Ticket");
const transcriptGenerator_1 = require("./transcriptGenerator");
class TicketManager {
    constructor(client) {
        this.client = client;
    }
    async setupSystem(channel) {
        try {
            const settings = this.client.settings.ticket;
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
            if (!settings.enabled) {
                throw new Error(locale?.messages?.disabled || 'Ticket system is disabled');
            }
            const embed = this.createSetupEmbed();
            const components = this.createTicketComponents();
            await channel.send({
                embeds: [embed],
                components
            });
        }
        catch (error) {
            console.error('Error setting up ticket system:', error);
            throw error;
        }
    }
    createSetupEmbed() {
        const settings = this.client.settings.ticket;
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale?.embeds?.setup?.title || 'Ticket System')
            .setDescription(locale?.embeds?.setup?.description || 'Click below to create a ticket')
            .setColor(settings.embed.color)
            .setTimestamp();
        if (settings.embed.thumbnail) {
            const thumbnail = settings.embed.thumbnail === '' ? null : settings.embed.thumbnail;
            embed.setThumbnail(thumbnail);
        }
        if (settings.embed.image) {
            const image = settings.embed.image === '' ? null : settings.embed.image;
            embed.setImage(image);
        }
        if (settings.embed.footer) {
            const footerIcon = settings.embed.footerIcon === '' ? null : settings.embed.footerIcon;
            embed.setFooter({
                text: settings.embed.footer,
                iconURL: footerIcon
            });
        }
        return embed;
    }
    createTicketComponents() {
        const settings = this.client.settings.ticket;
        const rows = [];
        let currentRow = new discord_js_1.ActionRowBuilder();
        let buttonCount = 0;
        const rowLimit = 5;
        settings.sections
            .filter((section) => section.enabled)
            .forEach((section) => {
            if (buttonCount >= rowLimit) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
                buttonCount = 0;
            }
            currentRow.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_create_${section.name.toLowerCase().replace(/\s+/g, '_')}`)
                .setLabel(section.name)
                .setEmoji(section.emoji)
                .setStyle(discord_js_1.ButtonStyle.Primary));
            buttonCount++;
        });
        if (buttonCount > 0) {
            rows.push(currentRow);
        }
        return rows;
    }
    async handleInteraction(interaction) {
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
        try {
            const settings = this.client.settings.ticket;
            if (!interaction.isButton()) {
                return;
            }
            const sectionName = interaction.customId.replace('ticket_create_', '');
            const section = settings.sections.find((s) => s.name.toLowerCase().replace(/\s+/g, '_') === sectionName);
            if (!section || !section.enabled) {
                await interaction.reply({
                    content: locale?.messages?.invalidSection || '❌ Invalid ticket section',
                    ephemeral: true
                });
                return;
            }
            const existingTickets = await Ticket_1.Ticket.find({
                guildId: interaction.guildId,
                userId: interaction.user.id,
                status: { $in: ['open', 'claimed'] }
            });
            if (existingTickets.length > 0) {
                await interaction.reply({
                    content: locale?.messages?.existingTicket || '❌ You already have an open ticket',
                    ephemeral: true
                });
                return;
            }
            const category = await interaction.guild?.channels.fetch(section.categoryId);
            if (!category || category.type !== discord_js_1.ChannelType.GuildCategory) {
                throw new Error('Invalid category');
            }
            const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
            const ticketChannel = await interaction.guild?.channels.create({
                name: channelName,
                type: discord_js_1.ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    {
                        id: this.client.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels']
                    },
                    ...section.adminRoles.map((roleId) => ({
                        id: roleId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }))
                ]
            });
            if (!ticketChannel) {
                throw new Error('Failed to create ticket channel');
            }
            const ticket = await Ticket_1.Ticket.create({
                guildId: interaction.guildId,
                channelId: ticketChannel.id,
                userId: interaction.user.id,
                section: section.name,
                status: 'open'
            });
            const embed = this.createTicketEmbed(ticket, interaction.member);
            const buttons = new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_claim_${ticket.id}`)
                .setLabel(locale?.buttons?.claim || 'Claim')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('👋'), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_close_${ticket.id}`)
                .setLabel(locale?.buttons?.close || 'Close')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('🔒'));
            await ticketChannel.send({
                content: `<@${interaction.user.id}> ${locale?.messages?.welcome || 'Welcome to your ticket!'}`,
                embeds: [embed],
                components: [buttons]
            });
            await interaction.reply({
                content: locale?.messages?.created?.replace('{channel}', `<#${ticketChannel.id}>`) ||
                    `✅ Ticket created: <#${ticketChannel.id}>`,
                ephemeral: true
            });
        }
        catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({
                content: locale?.messages?.error?.create || '❌ An error occurred while creating your ticket.',
                ephemeral: true
            });
        }
    }
    createTicketEmbed(ticket, member) {
        const settings = this.client.settings.ticket;
        const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
        const section = settings.sections.find((s) => s.name === ticket.section);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(settings.embed.color)
            .setAuthor({
            name: member.user.tag,
            iconURL: member.user.displayAvatarURL()
        })
            .addFields([
            {
                name: locale?.embeds?.ticket?.user || '👤 User',
                value: `<@${member.id}>`,
                inline: true
            },
            {
                name: locale?.embeds?.ticket?.created || '📅 Created',
                value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                inline: true
            },
            {
                name: locale?.embeds?.ticket?.section || '🏷️ Section',
                value: `${section?.emoji} ${section?.name}`,
                inline: true
            }
        ])
            .setTimestamp();
        if (section.imageUrl) {
            const imageUrl = section.imageUrl === '' ? null : section.imageUrl;
            embed.setImage(imageUrl);
        }
        if (settings.embed.thumbnail) {
            const thumbnail = settings.embed.thumbnail === '' ? null : settings.embed.thumbnail;
            embed.setThumbnail(thumbnail);
        }
        if (settings.embed.footer) {
            const footerIcon = settings.embed.footerIcon === '' ? null : settings.embed.footerIcon;
            embed.setFooter({
                text: settings.embed.footer,
                iconURL: footerIcon
            });
        }
        return embed;
    }
    async handleClaim(interaction) {
        try {
            const ticketId = interaction.customId.replace('ticket_claim_', '');
            const ticket = await Ticket_1.Ticket.findById(ticketId);
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
            if (!ticket || ticket.status !== 'open') {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
            if (!section) {
                await interaction.reply({
                    content: locale?.messages?.invalidSection || '❌ Invalid ticket section',
                    ephemeral: true
                });
                return;
            }
            const member = interaction.member;
            const hasPermission = section.adminRoles.some((roleId) => member.roles.cache.has(roleId));
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.noPermission || '❌ You do not have permission to claim this ticket',
                    ephemeral: true
                });
                return;
            }
            ticket.status = 'claimed';
            ticket.claimedBy = interaction.user.id;
            ticket.claimedAt = new Date();
            await ticket.save();
            const embed = this.createTicketEmbed(ticket, member);
            const closeButton = new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_close_${ticket.id}`)
                .setLabel(locale?.buttons?.close || 'Close')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('🔒'));
            await interaction.message.edit({
                embeds: [embed],
                components: [closeButton]
            });
            await interaction.reply({
                content: locale?.messages?.claimed?.replace('{user}', `<@${interaction.user.id}>`) ||
                    `✅ Ticket claimed by <@${interaction.user.id}>`,
            });
        }
        catch (error) {
            console.error('Error claiming ticket:', error);
            await interaction.reply({
                content: '❌ An error occurred while claiming the ticket.',
                ephemeral: true
            });
        }
    }
    async handleClose(interaction) {
        try {
            const ticketId = interaction.customId.replace('ticket_close_', '');
            const ticket = await Ticket_1.Ticket.findById(ticketId);
            const locale = this.client.locales.get(this.client.settings.defaultLanguage)?.ticket;
            if (!ticket || ticket.status === 'closed') {
                await interaction.reply({
                    content: locale?.messages?.invalidTicket || '❌ Invalid ticket',
                    ephemeral: true
                });
                return;
            }
            const section = this.client.settings.ticket.sections.find((s) => s.name === ticket.section);
            if (!section) {
                await interaction.reply({
                    content: locale?.messages?.invalidSection || '❌ Invalid ticket section',
                    ephemeral: true
                });
                return;
            }
            const member = interaction.member;
            const hasPermission = section.adminRoles.some((roleId) => member.roles.cache.has(roleId)) ||
                ticket.userId === member.id;
            if (!hasPermission) {
                await interaction.reply({
                    content: locale?.messages?.noPermission || '❌ You do not have permission to close this ticket',
                    ephemeral: true
                });
                return;
            }
            const channel = await interaction.guild?.channels.fetch(ticket.channelId);
            if (!channel) {
                throw new Error('Ticket channel not found');
            }
            await interaction.deferReply();
            const transcript = await (0, transcriptGenerator_1.createTranscript)(channel);
            const logChannel = await interaction.guild?.channels.fetch(section.logChannelId);
            if (logChannel) {
                const logEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(locale?.embeds?.log?.title || 'Ticket Closed')
                    .setColor(this.client.settings.ticket.embed.color)
                    .addFields([
                    {
                        name: locale?.embeds?.log?.ticket || 'Ticket',
                        value: `#${channel.name}`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.user || 'User',
                        value: `<@${ticket.userId}>`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.section || 'Section',
                        value: section.name,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.closedBy || 'Closed By',
                        value: `<@${interaction.user.id}>`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.createdAt || 'Created At',
                        value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:F>`,
                        inline: true
                    },
                    {
                        name: locale?.embeds?.log?.closedAt || 'Closed At',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: true
                    }
                ]);
                if (ticket.claimedBy) {
                    logEmbed.addFields({
                        name: locale?.embeds?.log?.claimedBy || 'Claimed By',
                        value: `<@${ticket.claimedBy}>`,
                        inline: true
                    });
                }
                await logChannel.send({
                    embeds: [logEmbed],
                    files: [transcript]
                });
            }
            ticket.status = 'closed';
            ticket.closedBy = interaction.user.id;
            ticket.closedAt = new Date();
            await ticket.save();
            const closeEmbed = new discord_js_1.EmbedBuilder()
                .setDescription(locale?.messages?.closing || '🔒 This ticket will be closed in 5 seconds...')
                .setColor(this.client.settings.ticket.embed.color);
            await interaction.editReply({
                embeds: [closeEmbed]
            });
            setTimeout(async () => {
                try {
                    await channel.delete();
                }
                catch (error) {
                    console.error('Error deleting ticket channel:', error);
                }
            }, 5000);
        }
        catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.reply({
                content: '❌ An error occurred while closing the ticket.',
                ephemeral: true
            }).catch(() => null);
        }
    }
}
exports.TicketManager = TicketManager;
