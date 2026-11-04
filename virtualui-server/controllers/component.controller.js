import User, { ROLES } from "../models/user.model.js";
import Component from "../models/component.model.js";
import { logger } from "../config/logger.js";

/**
 * POST /api/components
 *
 * Flow: input validate -> user check -> duplicate name check -> component save.
 * Admin ke components "public" hote hain, normal user ke "private".
 */
export const createComponent = async (req, res) => {
    try {
        const { name, code, props } = req.body;

        // Bina name/code ke component ka matlab nahi, DB tak jaane se pehle hi rok do
        if (!name?.trim() || !code?.trim()) {
            return res.status(400).json({ message: "name and code are required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }

        // ROLES constant use karo, role 'ADMIN' uppercase store hota hai ("admin" se match nahi hota)
        const isAdmin = user.role === ROLES.ADMIN;

        // Admin: public components me name unique hona chahiye (sab users ko dikhte hain).
        // User: sirf apne components me unique hona chahiye.
        const duplicateFilter = isAdmin
            ? { name, visibility: "public" }
            : { name, owner: req.userId };

        const alreadyExists = await Component.exists(duplicateFilter);
        if (alreadyExists) {
            const message = isAdmin
                ? "A public component with this name already exists"
                : "You already have a component with this name";
            return res.status(400).json({ message });
        }

        const component = await Component.create({
            name,
            code,
            props,
            owner: req.userId,
            visibility: isAdmin ? "public" : "private",
        });

        return res.status(201).json(component); // 201 = naya resource ban gaya
    } catch (error) {
        // Unique index (owner + name) tab fail hota hai jab do parallel requests duplicate check se nikal jaayein
        if (error.code === 11000) {
            return res.status(409).json({ message: "Component with this name already exists" });
        }

        // Catch khali mat chhodo, warna request hang ho jaati hai
        logger.error({ err: error }, "createComponent fail hua");
        return res.status(500).json({ message: "Component save nahi ho paya, dobara try karo" });
    }
};
