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
exports.hasPermission = exports.rolesHierarchy = exports.agents = void 0;
exports.sanitizeInput = sanitizeInput;
const validator_1 = __importDefault(require("validator"));
const userModel_1 = __importDefault(require("../users/userModel"));
function sanitizeInput(input) {
    return validator_1.default.escape(validator_1.default.trim(input));
}
exports.agents = new Map();
//USERS HEIRARCHy OBJECT
exports.rolesHierarchy = {
    admin: ["distributor", "subdistributor", "agent", "player"],
    distributor: ["subdistributor"],
    subdistributor: ["agent"],
    agent: ["player"],
};
//CHECKS PERMISSION TO PERFORM ACTIONS
const hasPermission = (requestingUserId, targetUserId, requestingUserRole) => __awaiter(void 0, void 0, void 0, function* () {
    if (!requestingUserId || !requestingUserRole || !targetUserId) {
        return false;
    }
    const requestingUser = yield userModel_1.default.findById(requestingUserId);
    if (!requestingUser)
        return false;
    console.log(requestingUser, "requesting user");
    const targetUserQuery = requestingUserRole === 'admin'
        ? { _id: targetUserId }
        : { _id: targetUserId, createdBy: requestingUserId };
    const targetUser = yield userModel_1.default.findOne(targetUserQuery);
    if (!targetUser)
        return false;
    console.log(targetUser, "targetUser");
    if (!targetUser)
        return false;
    const allowedRoles = exports.rolesHierarchy[requestingUserRole] || [];
    console.log(allowedRoles, "allowedroles");
    return allowedRoles.includes(targetUser.role);
});
exports.hasPermission = hasPermission;
