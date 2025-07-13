"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ticket = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ticketSchema = new mongoose_1.default.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    section: { type: String, required: true },
    status: { type: String, enum: ['open', 'claimed', 'closed'], default: 'open' },
    claimedBy: { type: String },
    closedBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    claimedAt: { type: Date },
    closedAt: { type: Date },
    transcriptUrl: { type: String }
});
exports.Ticket = mongoose_1.default.models.Ticket || mongoose_1.default.model('Ticket', ticketSchema);
