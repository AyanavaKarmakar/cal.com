import authedProcedure from "../../../../procedures/authedProcedure";
import { router } from "../../../../trpc";
import { ZBulkUpdateToDefaultAvailabilityInputSchema } from "./bulkUpdateDefaultAvailability.schema";
import { ZCreateInputSchema } from "./create.schema";
import { ZDeleteInputSchema } from "./delete.schema";
import { ZScheduleDuplicateSchema } from "./duplicate.schema";
import { ZGetInputSchema } from "./get.schema";
import { ZGetAllByUserIdInputSchema } from "./getAllSchedulesByUserId.schema";
import { ZGetByEventSlugInputSchema } from "./getScheduleByEventTypeSlug.schema";
import { ZGetByUserIdInputSchema } from "./getScheduleByUserId.schema";
import { ZUpdateInputSchema } from "./update.schema";

type ScheduleRouterHandlerCache = {
  get?: typeof import("./get.handler").getHandler;
  create?: typeof import("./create.handler").createHandler;
  delete?: typeof import("./delete.handler").deleteHandler;
  update?: typeof import("./update.handler").updateHandler;
  duplicate?: typeof import("./duplicate.handler").duplicateHandler;
  getScheduleByUserId?: typeof import("./getScheduleByUserId.handler").getScheduleByUserIdHandler;
  getAllSchedulesByUserId?: typeof import("./getAllSchedulesByUserId.handler").getAllSchedulesByUserIdHandler;
  getScheduleByEventSlug?: typeof import("./getScheduleByEventTypeSlug.handler").getScheduleByEventSlugHandler;
  bulkUpdateToDefaultAvailability?: typeof import("./bulkUpdateDefaultAvailability.handler").bulkUpdateToDefaultAvailabilityHandler;
};

const UNSTABLE_HANDLER_CACHE: ScheduleRouterHandlerCache = {};

const QUERY_TO_HANDLER_MAP = {
  "schedule.get": "./get.handler",
  "schedule.create": "./create.handler",
  "schedule.delete": "./delete.handler",
  "schedule.update": "./update.handler",
  "schedule.duplicate": "./duplicate.handler",
  "schedule.getScheduleByUserId": "./getScheduleByUserId.handler",
  "schedule.getAllSchedulesByUserId": "./getAllSchedulesByUserId.handler",
  "schedule.getScheduleByEventTypeSlug": "./getScheduleByEventTypeSlug.handler",
  "schedule.bulkUpdateDefaultAvailability": "./bulkUpdateDefaultAvailability.handler",
};
const handlerContext = require.context("./", false, /\.handler$/);

export const scheduleRouter = router({
  get: authedProcedure.input(ZGetInputSchema).query(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.get) {
      UNSTABLE_HANDLER_CACHE.get = await handlerContext(QUERY_TO_HANDLER_MAP[ctx.req.query.trpc]).getHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.get) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.get({
      ctx,
      input,
    });
  }),

  create: authedProcedure.input(ZCreateInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.create) {
      UNSTABLE_HANDLER_CACHE.create = await handlerContext(QUERY_TO_HANDLER_MAP[ctx.req.query.trpc])
        .createHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.create) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.create({
      ctx,
      input,
    });
  }),

  delete: authedProcedure.input(ZDeleteInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.delete) {
      UNSTABLE_HANDLER_CACHE.delete = await handlerContext(QUERY_TO_HANDLER_MAP[ctx.req.query.trpc])
        .deleteHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.delete) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.delete({
      ctx,
      input,
    });
  }),

  update: authedProcedure.input(ZUpdateInputSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.update) {
      UNSTABLE_HANDLER_CACHE.update = await handlerContext(QUERY_TO_HANDLER_MAP[ctx.req.query.trpc])
        .updateHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.update) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.update({
      ctx,
      input,
    });
  }),

  duplicate: authedProcedure.input(ZScheduleDuplicateSchema).mutation(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.duplicate) {
      UNSTABLE_HANDLER_CACHE.duplicate = await handlerContext(QUERY_TO_HANDLER_MAP[ctx.req.query.trpc])
        .duplicateHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.duplicate) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.duplicate({
      ctx,
      input,
    });
  }),

  getScheduleByUserId: authedProcedure.input(ZGetByUserIdInputSchema).query(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.getScheduleByUserId) {
      UNSTABLE_HANDLER_CACHE.getScheduleByUserId = await handlerContext(
        QUERY_TO_HANDLER_MAP[ctx.req.query.trpc]
      ).getScheduleByUserIdHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.getScheduleByUserId) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.getScheduleByUserId({
      ctx,
      input,
    });
  }),

  getAllSchedulesByUserId: authedProcedure.input(ZGetAllByUserIdInputSchema).query(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.getAllSchedulesByUserId) {
      UNSTABLE_HANDLER_CACHE.getAllSchedulesByUserId = await handlerContext(
        QUERY_TO_HANDLER_MAP[ctx.req.query.trpc]
      ).getAllSchedulesByUserIdHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.getAllSchedulesByUserId) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.getAllSchedulesByUserId({
      ctx,
      input,
    });
  }),

  getScheduleByEventSlug: authedProcedure.input(ZGetByEventSlugInputSchema).query(async ({ input, ctx }) => {
    if (!UNSTABLE_HANDLER_CACHE.getScheduleByEventSlug) {
      UNSTABLE_HANDLER_CACHE.getScheduleByEventSlug = await handlerContext(
        QUERY_TO_HANDLER_MAP[ctx.req.query.trpc]
      ).getScheduleByEventSlugHandler;
    }

    // Unreachable code but required for type safety
    if (!UNSTABLE_HANDLER_CACHE.getScheduleByEventSlug) {
      throw new Error("Failed to load handler");
    }

    return UNSTABLE_HANDLER_CACHE.getScheduleByEventSlug({
      ctx,
      input,
    });
  }),
  bulkUpdateToDefaultAvailability: authedProcedure
    .input(ZBulkUpdateToDefaultAvailabilityInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!UNSTABLE_HANDLER_CACHE.bulkUpdateToDefaultAvailability) {
        UNSTABLE_HANDLER_CACHE.bulkUpdateToDefaultAvailability = await handlerContext(
          QUERY_TO_HANDLER_MAP[ctx.req.query.trpc]
        ).bulkUpdateToDefaultAvailabilityHandler;
      }

      if (!UNSTABLE_HANDLER_CACHE.bulkUpdateToDefaultAvailability) {
        throw new Error("Failed to load handler");
      }

      return UNSTABLE_HANDLER_CACHE.bulkUpdateToDefaultAvailability({
        ctx,
        input,
      });
    }),
});
