"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const userModel_1 = __importDefault(require("../users/userModel"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const notificationModel_1 = __importDefault(require("./notificationModel"));
class NotificationService {
    constructor() {
        this.create = this.create.bind(this);
        this.get = this.get.bind(this);
        this.update = this.update.bind(this);
    }
    create(type, data, recipientId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const recipient = (yield userModel_1.default.findById(recipientId)) ||
                    (yield playerModel_1.default.findById(recipientId));
                if (!recipient) {
                    throw (0, http_errors_1.default)(401, "User not found");
                }
                const newNotification = new notificationModel_1.default({
                    type,
                    data,
                    recipient: recipientId,
                    viewed: false,
                });
                yield newNotification.save();
                return newNotification;
            }
            catch (error) {
                throw (0, http_errors_1.default)(500, error.message);
            }
        });
    }
    get(recipientId, viewedStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const recipient = (yield playerModel_1.default.findById(recipientId)) ||
                    userModel_1.default.findById(recipientId);
                if (!recipient) {
                    throw (0, http_errors_1.default)(401, "User not found");
                }
                const notifications = yield notificationModel_1.default.find(Object.assign({ recipient: recipientId }, (viewedStatus === "false" ? { viewed: false } : {}))).sort({ createdAt: -1 });
                return notifications;
            }
            catch (error) {
                console.error("Error fetching notifications:", error);
                throw (0, http_errors_1.default)(500, "Error fetching notifications");
            }
        });
    }
    update(notificationId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const notification = yield notificationModel_1.default.findById(notificationId);
                if (!notification) {
                    throw (0, http_errors_1.default)(404, "Notification not found");
                }
                notification.viewed = true;
                yield notification.save();
            }
            catch (error) {
                console.error("Error marking notification as read:", error);
                throw (0, http_errors_1.default)(500, "Error marking notification as viewed");
            }
        });
    }
}
exports.default = NotificationService;
