import { Router, type IRouter } from "express";
import healthRouter from "./health";
import farmRouter from "./farm";
import botRouter from "./bot";
import adminRouter from "./admin";
import socialRouter from "./social";
import avatarRouter from "./avatar";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/farm", farmRouter);
router.use("/bot", botRouter);
router.use("/admin", adminRouter);
router.use("/social", socialRouter);
router.use("/avatar", avatarRouter);

export default router;
