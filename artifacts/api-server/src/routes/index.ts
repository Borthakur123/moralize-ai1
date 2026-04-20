import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import healthRouter from "./health";
import postsRouter from "./posts";
import codersRouter from "./coders";
import annotationsRouter from "./annotations";
import statsRouter from "./stats";
import autoAnnotateRouter from "./auto-annotate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth as any, postsRouter);
router.use(requireAuth as any, codersRouter);
router.use(requireAuth as any, annotationsRouter);
router.use(requireAuth as any, statsRouter);
router.use(requireAuth as any, autoAnnotateRouter);

export default router;
