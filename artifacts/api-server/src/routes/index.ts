import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tradiesRouter from "./tradies";
import jobsRouter from "./jobs";
import adminRouter from "./admin";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tradiesRouter);
router.use(jobsRouter);
router.use(adminRouter);
router.use(webhooksRouter);

export default router;
