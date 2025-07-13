"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Warning = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const warningSchema = new mongoose_1.default.Schema({
    guildId: String,
    userId: String,
    moderatorId: String,
    reason: String,
    timestamp: Date
});
exports.Warning = mongoose_1.default.models.Warning || mongoose_1.default.model('Warning', warningSchema);
