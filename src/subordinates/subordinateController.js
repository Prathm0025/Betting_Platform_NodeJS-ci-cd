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
const bcrypt_1 = __importDefault(require("bcrypt"));
const utils_1 = require("../utils/utils");
const userModel_1 = __importDefault(require("../users/userModel"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
class SubordinateController {
    //CREATE SUBORDINATE
    createSubordinate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                //INPUT
                const { username, password, role } = req.body;
                const sanitizedUsername = (0, utils_1.sanitizeInput)(username);
                const sanitizedPassword = (0, utils_1.sanitizeInput)(password);
                const sanitizedRole = (0, utils_1.sanitizeInput)(role);
                if (!sanitizedUsername || !sanitizedPassword || !sanitizedRole)
                    throw (0, http_errors_1.default)(400, "Username, password and role are required");
                //SUPERIOR USER OR CREATOR
                const _req = req;
                const { userId, role: requestingUserRole } = _req.user;
                const superior = yield userModel_1.default.findById(userId);
                if (!superior)
                    throw (0, http_errors_1.default)(401, "Unauthorized");
                // PERMISSION CHECK
                const hasPermissionToCreate = () => {
                    console.log(requestingUserRole);
                    const allowedRoles = utils_1.rolesHierarchy[requestingUserRole];
                    if (requestingUserRole === superior.role)
                        return allowedRoles.includes(sanitizedRole);
                    return false;
                };
                if (!hasPermissionToCreate())
                    throw (0, http_errors_1.default)(403, "YOU DON'T HAVE PERMISSION");
                //CREATE
                let existingSubordinate;
                if (sanitizedRole === "player") {
                    existingSubordinate = yield playerModel_1.default.findOne({
                        username: sanitizedUsername,
                    });
                }
                else {
                    existingSubordinate = yield userModel_1.default.findOne({
                        username: sanitizedUsername,
                    });
                }
                if (existingSubordinate) {
                    throw (0, http_errors_1.default)(400, "username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(sanitizedPassword, SubordinateController.saltRounds);
                let newSubordinate;
                if (sanitizedRole === "player") {
                    newSubordinate = new playerModel_1.default({
                        username: sanitizedUsername,
                        password: hashedPassword,
                        role: sanitizedRole,
                        createdBy: userId,
                    });
                }
                else {
                    newSubordinate = new userModel_1.default({
                        username: sanitizedUsername,
                        password: hashedPassword,
                        role: sanitizedRole,
                        createdBy: userId,
                    });
                }
                yield newSubordinate.save();
                if (sanitizedRole === "player") {
                    console.log("playet");
                    console.log();
                    superior.players.push(newSubordinate._id);
                }
                else {
                    superior.subordinates.push(newSubordinate._id);
                }
                yield superior.save();
                //RESPONSE
                res.status(201).json({
                    message: `${role} Created Succesfully`,
                    Subordinate: newSubordinate,
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET SPECIFC SUBORDINATE DETAILS
    getSubordinate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username } = req.params;
            const _req = req;
            const { userId, role } = _req.user;
            try {
                const requestingUser = yield userModel_1.default.findById(userId);
                if (!requestingUser) {
                    throw (0, http_errors_1.default)(404, "User Not Found");
                }
                const subordinatesofRequestingUser = requestingUser.subordinates || [];
                const players = requestingUser.players || [];
                const sanitizedUsername = (0, utils_1.sanitizeInput)(username);
                const subordinate = (yield userModel_1.default.findOne({ username: sanitizedUsername }).select("-transactions -password")) ||
                    (yield playerModel_1.default.findOne({ username: sanitizedUsername }).select("-betHistory -transactions -password"));
                if (!subordinate) {
                    throw (0, http_errors_1.default)(404, "User not found");
                }
                if (role !== "admin" &&
                    (requestingUser === null || requestingUser === void 0 ? void 0 : requestingUser.username) !== username &&
                    !subordinatesofRequestingUser.includes(subordinate._id) &&
                    !players.includes(subordinate._id)) {
                    throw (0, http_errors_1.default)(401, "Unauthorized!");
                }
                res.status(200).json(subordinate);
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET ALL SUBORDINATES  (ADMIN SPECIFC)
    getAllSubordinates(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { type, search, date } = req.query;
                const _req = req;
                const { userId } = _req.user;
                const admin = yield userModel_1.default.findById(userId);
                if (!admin)
                    throw (0, http_errors_1.default)(401, "You are Not Authorized");
                let pipeline = [];
                if (type === "all") {
                    pipeline.push({
                        $unionWith: {
                            coll: "players",
                            pipeline: [
                                {
                                    $project: {
                                        _id: 1,
                                        username: 1,
                                        role: { $literal: "player" },
                                        status: 1,
                                        credits: 1,
                                        createdAt: 1,
                                    },
                                },
                            ],
                        },
                    });
                }
                else if (type === "player") {
                    pipeline.push({
                        $lookup: {
                            from: "players",
                            pipeline: [
                                {
                                    $project: {
                                        _id: 1,
                                        username: 1,
                                        role: { $literal: "player" },
                                        status: 1,
                                        credits: 1,
                                        createdAt: 1,
                                    },
                                },
                            ],
                            as: "players",
                        },
                    }, {
                        $unwind: "$players",
                    }, {
                        $replaceRoot: { newRoot: "$players" },
                    });
                }
                else {
                    pipeline.push({
                        $match: { role: type },
                    });
                }
                if (search) {
                    pipeline.push({
                        $match: {
                            username: { $regex: new RegExp(search, "i") },
                        },
                    });
                }
                if (date) {
                    const filterDate = new Date(date);
                    pipeline.push({
                        $match: {
                            createdAt: {
                                $gte: new Date(filterDate.setHours(0, 0, 0, 0)),
                                $lt: new Date(filterDate.setHours(23, 59, 59, 999)),
                            },
                        },
                    });
                }
                pipeline.push({
                    $group: {
                        _id: "$_id",
                        username: { $first: "$username" },
                        role: { $first: "$role" },
                        status: { $first: "$status" },
                        credits: { $first: "$credits" },
                        createdAt: { $first: "$createdAt" },
                    },
                });
                // Perform aggregation
                const results = yield userModel_1.default.aggregate(pipeline).sort({ createdAt: -1 });
                res.status(200).json(results);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    //UPDATE USER (SUBORDINATES)
    updateSubordinate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password, status } = req.body;
            const { id } = req.params;
            try {
                //INPUT
                const sanitizedUsername = username ? (0, utils_1.sanitizeInput)(username) : undefined;
                const sanitizedPassword = password ? (0, utils_1.sanitizeInput)(password) : undefined;
                const sanitizedStatus = status ? (0, utils_1.sanitizeInput)(status) : undefined;
                const _req = req;
                const { userId, role } = _req.user;
                // PERMISSION CHECK
                const hasPermissionToUpadte = yield (0, utils_1.hasPermission)(userId, id, role);
                if (!hasPermissionToUpadte) {
                    throw (0, http_errors_1.default)(403, "You do not have permission to update this user.");
                }
                //UPDATE
                const updateData = Object.assign(Object.assign(Object.assign({}, (sanitizedUsername && { username: sanitizedUsername })), (sanitizedPassword && {
                    password: yield bcrypt_1.default.hash(sanitizedPassword, SubordinateController.saltRounds),
                })), (sanitizedStatus && { status: sanitizedStatus }));
                const updateSubordinate = yield userModel_1.default.findByIdAndUpdate(id, updateData, {
                    new: true,
                });
                if (!updateSubordinate) {
                    throw (0, http_errors_1.default)(404, "User not found");
                }
                res.status(200).json({
                    message: "User updated successfully",
                    agent: updateSubordinate,
                });
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    //DELETE SUBORDINATE
    deleteSubordinate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const _req = req;
                const { userId, role } = _req.user;
                const superior = yield userModel_1.default.findById(userId);
                if (!superior)
                    throw (0, http_errors_1.default)(401, "Unauthorized");
                //PERMISSION CHECK
                const hasPermissionToDelete = yield (0, utils_1.hasPermission)(userId, id, role);
                if (!hasPermissionToDelete)
                    throw (0, http_errors_1.default)(401, "You do not have permission to delete this user");
                //DELETE
                const deleteSubordinate = yield userModel_1.default.findByIdAndDelete(id);
                if (!deleteSubordinate)
                    throw (0, http_errors_1.default)(404, "Unable to Delete");
                //REMOVING SUBORDINATE REFERENCE FROM SUPERIOR
                superior.subordinates = superior.subordinates.filter((superiorId) => superiorId.toString() !== id);
                yield superior.save();
                res.status(200).json({ message: "User deleted successfully" });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET SUBORDINATE UNDER SUPERIOR
    getSubordinatessUnderSuperior(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { superior } = req.params;
                const { type, search, date } = req.query;
                const _req = req;
                const { userId } = _req.user;
                let requestingUser = yield userModel_1.default.findById(userId);
                let subordinatesofRequestingUser = requestingUser.subordinates || [];
                let players = requestingUser.players || [];
                let superiorUser;
                // GETTING SUBORDINATE BASED ON QUERY TYPE(username, id)
                if (type === "id") {
                    superiorUser = yield userModel_1.default.findById(superior).select("-password -transactions");
                    if (!superiorUser) {
                        throw (0, http_errors_1.default)(404, "Superior user not found");
                    }
                    if (requestingUser.role !== "admin" &&
                        ((_a = requestingUser === null || requestingUser === void 0 ? void 0 : requestingUser._id) === null || _a === void 0 ? void 0 : _a.toString()) !== superior &&
                        !subordinatesofRequestingUser.includes(superiorUser._id) &&
                        !players.includes(superiorUser._id)) {
                        console.log("here", subordinatesofRequestingUser, superiorUser._id);
                        throw (0, http_errors_1.default)(401, "Not Authorised");
                    }
                    //PLAYERS FOR AGENT(AGENT HAS PLAYERS AS SUBORDINATE)
                    if (superiorUser.role === "agent") {
                        superiorUser = yield userModel_1.default.findById(superior).populate({
                            path: "players",
                            select: "-password",
                        });
                    }
                    else {
                        superiorUser = yield userModel_1.default.findById(superior).populate({
                            path: "subordinates players",
                            select: "-password",
                        });
                    }
                    if (!superiorUser)
                        throw (0, http_errors_1.default)(404, "User Not Found");
                }
                else if (type === "username") {
                    superiorUser = yield userModel_1.default.findOne({ username: superior }).select("-password -transactions");
                    if (!superiorUser) {
                        throw (0, http_errors_1.default)(404, "Superior user not found");
                    }
                    if (requestingUser.role !== "admin" &&
                        (requestingUser === null || requestingUser === void 0 ? void 0 : requestingUser.username) !== superior &&
                        !subordinatesofRequestingUser.includes(superiorUser._id) &&
                        !players.includes(superiorUser._id)) {
                        console.log("here", subordinatesofRequestingUser, superiorUser._id);
                        throw (0, http_errors_1.default)(401, "Not Authorised");
                    }
                    superiorUser = yield userModel_1.default.findOne({ username: superior }).populate({
                        path: "subordinates players",
                        select: "-password",
                    });
                    if (!superiorUser)
                        throw (0, http_errors_1.default)(404, "User Not Found with the provided username");
                }
                else {
                    throw (0, http_errors_1.default)(400, "Usr Id or Username not provided");
                }
                // ACCESS SUBORDINATE DEPENDING ON ROLE
                let subordinates = superiorUser.role === "admin"
                    ? [...superiorUser.subordinates, ...superiorUser.players]
                    : superiorUser.role === "agent"
                        ? superiorUser.players
                        : superiorUser.subordinates;
                if (search) {
                    const regex = new RegExp(search, "i"); // 'i' for case-insensitive matching
                    subordinates = subordinates.filter((subordinate) => regex.test(subordinate.username));
                }
                if (date) {
                    const filterDate = new Date(date);
                    filterDate.setHours(0, 0, 0, 0);
                    const nextDay = new Date(filterDate);
                    nextDay.setDate(filterDate.getDate() + 1);
                    subordinates = subordinates.filter((subordinate) => {
                        const createdAt = new Date(subordinate.createdAt);
                        return createdAt >= filterDate && createdAt < nextDay;
                    });
                }
                return res.status(200).json(subordinates);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
}
SubordinateController.saltRounds = 10;
SubordinateController.roles = Object.freeze([
    "all",
    "distributor",
    "subdistributor",
    "agent",
    "player",
]);
exports.default = new SubordinateController();
