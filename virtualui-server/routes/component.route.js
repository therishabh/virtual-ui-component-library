import { Router } from "express";
import { generateAiComponent } from "../controllers/aicomponent.controller.js";
import { createComponent } from "../controllers/component.controller.js";
import isAuth from "../middlewares/auth.middleware.js";

// Saare component endpoints login ke baad hi, isliye router level pe ek baar isAuth
const componentRouter = Router();
componentRouter.use(isAuth);

// POST /api/components/generate : AI se component banao (save nahi hota, sirf preview ke liye)
componentRouter.post("/generate", generateAiComponent);

// POST /api/components : component DB me save karo
componentRouter.post("/", createComponent);

export default componentRouter;
