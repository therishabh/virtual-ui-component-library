import { Router } from "express";
// ESM me file extension (.js) likhna zaroori hai, CommonJS jaisa bina extension nahi chalta
import { googleAuth, logout } from "../controllers/auth.controller.js";

// Route file ka kaam sirf URL + HTTP method ko controller se jodna hai.
// Business logic yahan nahi, controller me rakho. Mount path (/api/auth) app.js me set hai.
const authRouter = Router();

// POST /api/auth/google : login / signup
authRouter.post('/google', googleAuth);

// POST /api/auth/logout : state change karne wale endpoints GET nahi, POST hone chahiye.
// GET se koi <img src=".../logout"> laga ke user ko chupke se logout (CSRF) kara sakta hai,
// aur browsers/prefetchers GET ko apne aap call bhi kar dete hain.
authRouter.post('/logout', logout);

export default authRouter;
