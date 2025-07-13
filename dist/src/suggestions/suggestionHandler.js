"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSuggestion = void 0;
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const cooldowns = new Map();
const formatFileSize = (bytes) => {
    return `${(bytes / (1024 * 1024)).toFixed(2)}`;
};
const createEmbedFields = (message, locale) => {
    const fields = [
        {
            name: `👤 ${locale.author}`,
            value: `${message.author.tag} (<@${message.author.id}>)`,
            inline: true
        },
        {
            name: `⏰ ${locale.createdAt}`,
            value: (0, discord_js_1.time)(new Date(), discord_js_1.TimestampStyles.RelativeTime),
            inline: true
        }
    ];
    return fields;
};
const prepareImage = async (url, filename) => {
    try {
        const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
        return new discord_js_1.AttachmentBuilder(Buffer.from(response.data), { name: filename });
    }
    catch (error) {
        console.error('Failed to download image:', error);
        return null;
    }
};
const handleSuggestion = async (message) => {
    const client = message.client;
    const settings = client.settings;
    try {
        if (!settings.suggestions?.enabled)
            return;
        if (!message.guild || message.author.bot)
            return;
        if (!settings.suggestions.channels.includes(message.channel.id))
            return;
        if (!(message.channel instanceof discord_js_1.TextChannel) &&
            !(message.channel instanceof discord_js_1.ThreadChannel)) {
            return;
        }
        const guildLocale = settings.defaultLanguage || 'en';
        const locale = client.locales.get(guildLocale)?.suggestions;
        if (!locale) {
            throw new Error('LOCALE_NOT_FOUND');
        }
        const now = Date.now();
        const lastSuggestion = cooldowns.get(message.author.id) || 0;
        if (now - lastSuggestion < settings.suggestions.cooldown) {
            const timeLeft = Math.ceil((settings.suggestions.cooldown - (now - lastSuggestion)) / 1000);
            await message.reply(locale.error.cooldown.replace('{time}', `${timeLeft} seconds`));
            return;
        }
        if (!message.content) {
            await message.reply(locale.error.noContent);
            return;
        }
        if (message.content.length < settings.suggestions.minContentLength) {
            await message.reply(locale.error.tooShort.replace('{min}', settings.suggestions.minContentLength.toString()));
            return;
        }
        if (message.content.length > settings.suggestions.maxContentLength) {
            await message.reply(locale.error.tooLong.replace('{max}', settings.suggestions.maxContentLength.toString()));
            return;
        }
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (message.attachments.size > 1) {
                throw new Error('TOO_MANY_IMAGES');
            }
            if (!settings.suggestions.allowImages) {
                throw new Error('IMAGES_NOT_ALLOWED');
            }
            if (attachment && attachment.size > settings.suggestions.maxImageSize) {
                throw new Error('IMAGE_TOO_LARGE');
            }
            if (attachment && !attachment.contentType?.startsWith('image/')) {
                throw new Error('INVALID_FILE_TYPE');
            }
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(locale.title)
            .setColor(settings.suggestions.color)
            .setTimestamp()
            .setDescription(message.content)
            .setFields(createEmbedFields(message, locale))
            .setFooter({
            text: locale.footer.replace('{id}', message.id),
            iconURL: message.author.displayAvatarURL()
        });
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType?.startsWith('image/')) {
                const newAttachment = await prepareImage(attachment.url, attachment.name);
                if (newAttachment) {
                    const suggestionMsg = await message.channel
                        .send({
                        embeds: [embed.setImage('attachment://' + attachment.name)],
                        files: [newAttachment]
                    }).catch(() => {
                        throw new Error('SEND_ERROR');
                    });
                    await handleReactionsAndThread(suggestionMsg, settings, message, client);
                    await cleanupActions(message, now, settings);
                    return;
                }
            }
        }
        const suggestionMsg = await message.channel
            .send({ embeds: [embed] }).catch(() => {
            throw new Error('SEND_ERROR');
        });
        await handleReactionsAndThread(suggestionMsg, settings, message, client);
        await cleanupActions(message, now, settings);
        return;
    }
    catch (error) {
        console.error('Error handling suggestion:', error);
        if (error instanceof Error) {
            const guildLocale = settings.defaultLanguage || 'en';
            const locale = client.locales.get(guildLocale)?.suggestions.error;
            let errorMessage = 'An error occurred';
            switch (error.message) {
                case 'TOO_MANY_IMAGES':
                    errorMessage = locale?.tooManyImages;
                    break;
                case 'IMAGES_NOT_ALLOWED':
                    errorMessage = 'Images are not allowed in suggestions.';
                    break;
                case 'IMAGE_TOO_LARGE':
                    errorMessage = locale?.imageTooLarge.replace('{size}', formatFileSize(settings.suggestions.maxImageSize));
                    break;
                case 'INVALID_FILE_TYPE':
                    errorMessage = 'Only image files are allowed.';
                    break;
                case 'SEND_ERROR':
                    errorMessage = 'Failed to send suggestion. Please try again later.';
                    break;
                default:
                    errorMessage = 'An unexpected error occurred. Please try again later.';
            }
            try {
                await message.reply({ content: errorMessage });
            }
            catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
        return;
    }
};
exports.handleSuggestion = handleSuggestion;
const handleReactionsAndThread = async (suggestionMsg, settings, message, client) => {
    if (settings.suggestions.reactions.enabled) {
        try {
            await suggestionMsg.react(settings.suggestions.reactions.upvote);
            await suggestionMsg.react(settings.suggestions.reactions.downvote);
            await suggestionMsg.react(settings.suggestions.reactions.star);
        }
        catch (error) {
            console.error('Failed to add reactions:', error);
        }
    }
    if (settings.suggestions.thread.enabled && message.channel instanceof discord_js_1.TextChannel) {
        try {
            const threadName = settings.suggestions.thread.name
                .replace('{title}', message.content.slice(0, 50) + (message.content.length > 50 ? '...' : ''));
            const thread = await suggestionMsg.startThread({
                name: threadName,
                autoArchiveDuration: settings.suggestions.thread.autoArchiveDuration
            });
            const guildLocale = settings.defaultLanguage || 'en';
            const threadLocale = client.locales.get(guildLocale)?.suggestions;
            const welcomeMessage = threadLocale?.threadWelcome || 'Welcome to the discussion thread for your suggestion! Others can discuss and provide feedback here.';
            await thread.send({
                content: `${message.author} ${welcomeMessage}`
            });
        }
        catch (error) {
            console.error('Failed to create discussion thread:', error);
        }
    }
};
const cleanupActions = async (message, now, settings) => {
    cooldowns.set(message.author.id, now);
    if (settings.suggestions.deleteOriginal) {
        await message.delete().catch(() => {
            console.error('Failed to delete original message');
        });
    }
};
