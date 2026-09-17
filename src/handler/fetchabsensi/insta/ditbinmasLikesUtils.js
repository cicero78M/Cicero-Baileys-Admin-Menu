import { normalizeUsername } from "../../../utils/likesHelper.js";

function getInstagramUsernameAliases(user) {
  return [...new Set([
    user?.effective_insta,
    user?.insta,
    user?.insta_legacy,
  ].filter((value) => typeof value === "string" && value.trim() !== "").map(normalizeUsername))];
}

export function computeDitbinmasLikesStats(
  users = [],
  likesSets = [],
  totalKonten = 0
) {
  const safeLikesSets = Array.isArray(likesSets) ? likesSets : [];

  const userStats = (users || []).map((user) => {
    if (!user || typeof user !== "object") return user;

    const base = { ...user, count: 0 };
    const aliases = getInstagramUsernameAliases(user);

    if (aliases.length === 0) {
      return { ...base, status: "noUsername" };
    }
    let count = 0;
    safeLikesSets.forEach((set) => {
      if (set && typeof set.has === "function" && aliases.some((username) => set.has(username))) {
        count += 1;
      }
    });

    let status = "belum";
    if (totalKonten > 0) {
      if (count >= totalKonten) status = "lengkap";
      else if (count > 0) status = "kurang";
    }

    return { ...base, count, status };
  });

  const summary = userStats.reduce(
    (acc, user) => {
      if (!user || typeof user !== "object") return acc;

      acc.total += 1;
      switch (user.status) {
        case "noUsername":
          acc.noUsername += 1;
          break;
        case "lengkap":
          acc.lengkap += 1;
          break;
        case "kurang":
          acc.kurang += 1;
          break;
        default:
          acc.belum += 1;
          break;
      }
      return acc;
    },
    { total: 0, lengkap: 0, kurang: 0, belum: 0, noUsername: 0 }
  );

  return { userStats, summary };
}
