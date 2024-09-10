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
const playerModel_1 = __importDefault(require("../players/playerModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const userModel_1 = __importDefault(require("../users/userModel"));
const notificationModel_1 = __importDefault(require("./notificationModel"));
class NotificationController {
    createNotification(initiatorId, type, message, reference, referenceId, action) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const user = (yield userModel_1.default.findById(initiatorId)) ||
                    (yield playerModel_1.default.findById(initiatorId));
                if (!user) {
                    throw (0, http_errors_1.default)(401, "User not found");
                }
                const initiatorModel = user.role !== "player" ? 'User' : 'Player';
                let targetId;
                let targetModel;
                if (user.role !== "admin") {
                    targetId = user.createdBy;
                    const targetUser = (yield userModel_1.default.findById(targetId)) ||
                        (yield playerModel_1.default.findById(targetId));
                    if (!targetUser) {
                        throw (0, http_errors_1.default)(401, "Target User not found");
                    }
                    targetModel = targetUser.role === "player" ? 'Player' : 'User';
                }
                else {
                    targetId = null;
                    targetModel = null;
                }
                const newNotification = new notificationModel_1.default({
                    initiatorId,
                    targetId,
                    initiatorModel,
                    targetModel,
                    type,
                    message,
                    reference,
                    referenceId,
                    status: "pending",
                    action: action
                });
                const savedNotification = yield newNotification.save();
                //   let updateResult;
                //   if (targetModel === "Player") {
                //     updateResult = await Player.findByIdAndUpdate(
                //       targetId,
                //       { $push: { notifications: savedNotification._id } },
                //       { new: true, useFindAndModify: false }
                //     );
                //   } else if (targetModel === "User") {
                //     updateResult = await User.findByIdAndUpdate(
                //       targetId,
                //       { $push: { notifications: savedNotification._id } },
                //       { new: true, useFindAndModify: false }
                //     );
                //   }
                //   if (!updateResult) {
                //     throw new Error(`Failed to update ${targetModel} with id ${targetId}`);
                //   }
                console.log("Notification created and target updated successfully.");
            }
            catch (error) {
                console.error("Error creating notification:", error);
                throw new Error("Failed to create notification.");
            }
        });
    }
    getUserNotification(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const _req = req;
            const { userId } = _req.user;
            try {
                const notifications = yield notificationModel_1.default.find({ targetId: userId });
                if (!notifications) {
                    throw (0, http_errors_1.default)(404, "No notifications found for user");
                }
                return res.status(200).json(notifications);
            }
            catch (error) {
                next(error);
            }
        });
    }
    ;
    resolveNotification(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { notificationId } = req.params;
                const { status } = req.body;
                const notificaion = yield notificationModel_1.default.findById(notificationId);
                if (!notificaion) {
                    throw (0, http_errors_1.default)(404, "Notification not found!");
                }
                notificaion.status = status;
                yield notificaion.save();
                res.status(200).json({
                    message: "Notification Resolved"
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = new NotificationController();
