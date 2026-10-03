import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local", override: true });

console.log(
  "Drizzle DB host:",
  process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "MISSING"
);

export default defineConfig({
  schema: "./db/schema",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});