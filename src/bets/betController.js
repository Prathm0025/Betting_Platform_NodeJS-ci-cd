"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BetController {
    sayHello(req, res, next) {
        res.status(200).json({ message: "Admin" });
    }
}
exports.default = new BetController();
