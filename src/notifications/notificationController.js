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
const notificationServices_1 = __importDefault(require("./notificationServices"));
class NotificationController {
    constructor() {
        // Using arrow functions to preserve `this` context
        this.getNotifications = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const _req = req;
            console.log(_req.user, "user");
            const { userId: recipientId } = _req === null || _req === void 0 ? void 0 : _req.user;
            const { viewedStatus } = req.query;
            try {
                if (!recipientId) {
                    throw (0, http_errors_1.default)(400, "Recipient ID is required");
                }
                const notifications = yield this.notificationService.get(recipientId, viewedStatus);
                res.status(200).json(notifications);
            }
            catch (error) {
                next(error);
            }
        });
        this.markNotificationAsViewed = (notificationId) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!notificationId) {
                    throw (0, http_errors_1.default)(400, "Notification ID is required");
                }
                yield this.notificationService.update(notificationId);
            }
            catch (error) {
                return error;
            }
        });
        this.markNotificationViewed = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const _req = req;
            const { userId: recipientId } = _req.user;
            const { notificationId } = req.query;
            try {
                if (!recipientId) {
                    throw (0, http_errors_1.default)(400, "Recipient ID is required");
                }
                const notifications = yield this.markNotificationAsViewed(notificationId);
                res.status(200).json(notifications);
            }
            catch (error) {
                next(error);
            }
        });
        this.createNotification = (type, payload, recipientId) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!type || !payload || !recipientId) {
                    throw (0, http_errors_1.default)(400, "Type, payload, and recipientId are required");
                }
                const newNotification = yield this.notificationService.create(type, payload, recipientId);
                return newNotification;
            }
            catch (error) {
                return error;
            }
        });
        this.notificationService = new notificationServices_1.default();
    }
}
exports.default = new NotificationController();
