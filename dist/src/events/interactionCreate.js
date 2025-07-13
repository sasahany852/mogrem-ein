"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.once = exports.name = void 0;
exports.execute = execute;
const ticketManager_1 = require("../ticket/ticketManager");
exports.name = 'interactionCreate';
exports.once = false;
async function execute(interaction, client) {
    try {
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_create' ||
                interaction.customId.startsWith('ticket_create_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                if (interaction.isButton()) {
                    await ticketManager.handleInteraction(interaction);
                }
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_claim_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.handleClaim(interaction);
                return;
            }
            if (interaction.isButton() && interaction.customId.startsWith('ticket_close_')) {
                const ticketManager = new ticketManager_1.TicketManager(client);
                await ticketManager.handleClose(interaction);
                return;
            }
        }
    }
    catch (error) {
        console.error('Error handling interaction:', error);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            }).catch(() => {
                console.error('Could not send error response');
            });
        }
    }
}
