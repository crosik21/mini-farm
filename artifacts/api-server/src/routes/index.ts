import { Router, type IRouter } from "express";
import healthRouter from "./health";
import farmRouter from "./farm";
import botRouter from "./bot";
import adminRouter from "./admin";
import socialRouter from "./social";
import avatarRouter from "./avatar";
import fishingRouter, { createFarmFishingAliasRouter } from "./fishing";
import marketRouter from "./market";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/farm", farmRouter);
router.use("/farm", createFarmFishingAliasRouter());
router.use("/bot", botRouter);
router.use("/admin", adminRouter);
router.use("/social", socialRouter);
router.use("/avatar", avatarRouter);
router.use("/fishing", fishingRouter);
router.use("/market", marketRouter);

export default router;
