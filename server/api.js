import { staffMiddleware } from "./staff/api.js";
import { contentMiddleware, loadContent } from "./content.js";
import { nextcloudMiddleware } from "./nextcloud.js";
import { createOfficialSourcesService } from "./officialSources/sourceCache.js";
import { officialSourcesMiddleware } from "./officialSources/api.js";
import { createCommunityFeedService } from "./community/service.js";
export function applicationApi(env, fetchImpl = fetch) {
  const officialService = createOfficialSourcesService({ env, fetchImpl });
  const communityService = createCommunityFeedService({ env, fetchImpl });
  const official = officialSourcesMiddleware(env, fetchImpl, officialService);
  const staff = staffMiddleware(env, fetchImpl);
  const content = contentMiddleware(env, fetchImpl, () => officialService.getPublicSources(), (community) => communityService.getPublic(community)),
    documents = nextcloudMiddleware(env, fetchImpl, async (path) => {
      const collections = await Promise.all(
        ["onboarding", "after-arrival"].map((kind) =>
          loadContent(kind, env, fetchImpl),
        ),
      );
      return collections.some(
        (result) =>
          result.source === "nextcloud" &&
          result.data.topics.some(
            (topic) =>
              !topic.isDemo &&
              topic.documents.some((document) => document.path === path),
          ),
      );
    });
  return (req, res, next) =>
    official(req, res, () => staff(req, res, () =>
      content(req, res, () => documents(req, res, () => {
          if (
            new URL(req.url, "http://localhost").pathname.startsWith("/api/")
          ) {
            res
              .writeHead(404, { "Content-Type": "application/json" })
              .end(JSON.stringify({ error: "Not found." }));
          } else next();
      })),
    ));
}
