import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url:
      process.env.TURSO_DATABASE_URL ||
      process.env.LOCAL_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "file:./prisma/dev.db",
  },
});
