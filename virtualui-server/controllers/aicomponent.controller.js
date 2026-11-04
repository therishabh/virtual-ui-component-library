import User, { ROLES } from "../models/user.model.js";
import { logger } from "../config/logger.js";
import { askAI } from "../utils/openRouter.js";
import { buildComponentMessages } from "../prompts/componentGenerator.prompt.js";

const AI_CREDIT_COST = 10;

export const generateAiComponent = async (req, res) => {
    // Credits kaat liye gaye ya nahi, taaki AI fail hone pe refund kar sakein
    let user = null;
    let creditsDeducted = false;

    try {
        const { prompt } = req.body;

        // Bina prompt ke AI call (aur credits) waste na ho
        if (typeof prompt !== "string" || !prompt.trim()) {
            return res.status(400).json({ message: "prompt is required" });
        }

        user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ message: "user not found" });
        }

        if (user.role === ROLES.USER) {
            if (user.aiCredits < AI_CREDIT_COST) {
                return res.status(400).json({ message: "Not enough AI Credits" });
            }

            user.aiCredits -= AI_CREDIT_COST;
            await user.save();
            creditsDeducted = true;
        }

        const messages = buildComponentMessages(prompt);
        const result = await askAI(messages);

        // Model kabhi galat shape bhej sakta hai, isliye validate karo
        if (!result?.name || typeof result.code !== "string") {
            throw new Error("AI ne invalid component response diya");
        }

        return res.status(200).json({
            name: result.name,
            code: result.code,
            props: Array.isArray(result.props) ? result.props : [],
            aiCredits: user.aiCredits,
        });
    } catch (error) {
        // Pehle catch khali tha -> request hang ho jaati thi. Ab log + refund + response.
        logger.error({ err: error }, "generateComponent fail hua");

        if (creditsDeducted) {
            try {
                user.aiCredits += AI_CREDIT_COST;
                await user.save();
            } catch (refundErr) {
                logger.error({ err: refundErr }, "credits refund fail hua");
            }
        }

        return res.status(500).json({ message: "Component generate nahi ho paya, dobara try karo" });
    }
};