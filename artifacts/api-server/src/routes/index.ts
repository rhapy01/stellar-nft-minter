import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mintsRouter from "./mints";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mintsRouter);

export default router;
