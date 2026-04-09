import { createApiApp } from "../src/api/api-app.ts";

const app = createApiApp();

export default {
  fetch: app.fetch,
};
