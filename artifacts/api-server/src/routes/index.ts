import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postsRouter from "./posts";
import codersRouter from "./coders";
import annotationsRouter from "./annotations";
import statsRouter from "./stats";
import autoAnnotateRouter from "./auto-annotate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(postsRouter);
router.use(codersRouter);
router.use(annotationsRouter);
router.use(statsRouter);
router.use(autoAnnotateRouter);

export default router;
