import type { TitleSeed } from "@watch-recommender/shared";
import { build, type RawTitle } from "../shape";

/**
 * Growable-dataset registry. Each batch file exports a RAW: RawTitle[] of new,
 * hand-curated titles (same shape/taxonomy as prisma/seed-data/titles.ts, never touching that
 * file). Add a new batch file under this folder, then list it here — that's the whole append
 * step. scripts/seed-batches.ts upserts everything registered here into the DB independently of
 * the core seed, so growing the dataset never requires touching or re-seeding titles.ts.
 */
import { RAW as BATCH_001 } from "./001-platform-gaps";
import { RAW as BATCH_002 } from "./002-apple-tv";
import { RAW as BATCH_003 } from "./003-disney-hotstar";
import { RAW as BATCH_004 } from "./004-prime-video";
import { RAW as BATCH_005 } from "./005-hulu";
import { RAW as BATCH_006 } from "./006-hbo-max";
import { RAW as BATCH_007 } from "./007-crunchyroll-anime";
import { RAW as BATCH_008 } from "./008-netflix";
import { RAW as BATCH_009 } from "./009-anime-and-ghibli";
import { RAW as BATCH_010 } from "./010-docs-and-family";
import { RAW as BATCH_011 } from "./011-mixed-platforms";
import { RAW as BATCH_012 } from "./012-more-movies";
import { RAW as BATCH_013 } from "./013-international";
import { RAW as BATCH_014 } from "./014-hulu-and-crunchyroll";
import { RAW as BATCH_015 } from "./015-indian-cinema-and-more-korean";
import { RAW as BATCH_016 } from "./016-action-blockbusters";
import { RAW as BATCH_017 } from "./017-more-anime";
import { RAW as BATCH_018 } from "./018-anime-and-balance";
import { RAW as BATCH_019 } from "./019-marvel-pixar-dc";
import { RAW as BATCH_020 } from "./020-thriller-mystery-mix";
import { RAW as BATCH_021 } from "./021-hulu-and-apple-tv-2";
import { RAW as BATCH_022 } from "./022-more-movies-2";
import { RAW as BATCH_023 } from "./023-disney-classics-prime";
import { RAW as BATCH_024 } from "./024-limited-series";
import { RAW as BATCH_025 } from "./025-more-anime-and-family";
import { RAW as BATCH_026 } from "./026-hbo-classics";
import { RAW as BATCH_027 } from "./027-hulu-prime-small";
import { RAW as BATCH_028 } from "./028-apple-tv-small";
import { RAW as BATCH_029 } from "./029-more-crunchyroll";
import { RAW as BATCH_030 } from "./030-more-movies-small";
import { RAW as BATCH_031 } from "./031-hbo-shows-small";
import { RAW as BATCH_032 } from "./032-more-prime-small";
import { RAW as BATCH_033 } from "./033-disney-small";
import { RAW as BATCH_034 } from "./034-hulu-small-2";
import { RAW as BATCH_035 } from "./035-mixed-medium";
import { RAW as BATCH_036 } from "./036-multilingual-expansion";
import { RAW as BATCH_037 } from "./037-multilingual-expansion-2";
import { RAW as BATCH_038 } from "./038-malayalam-tamil-priority";

const ALL_RAW: RawTitle[] = [
  ...BATCH_001,
  ...BATCH_002,
  ...BATCH_003,
  ...BATCH_004,
  ...BATCH_005,
  ...BATCH_006,
  ...BATCH_007,
  ...BATCH_008,
  ...BATCH_009,
  ...BATCH_010,
  ...BATCH_011,
  ...BATCH_012,
  ...BATCH_013,
  ...BATCH_014,
  ...BATCH_015,
  ...BATCH_016,
  ...BATCH_017,
  ...BATCH_018,
  ...BATCH_019,
  ...BATCH_020,
  ...BATCH_021,
  ...BATCH_022,
  ...BATCH_023,
  ...BATCH_024,
  ...BATCH_025,
  ...BATCH_026,
  ...BATCH_027,
  ...BATCH_028,
  ...BATCH_029,
  ...BATCH_030,
  ...BATCH_031,
  ...BATCH_032,
  ...BATCH_033,
  ...BATCH_034,
  ...BATCH_035,
  ...BATCH_036,
  ...BATCH_037,
  ...BATCH_038,
];

export const BATCH_TITLES: TitleSeed[] = ALL_RAW.map(build);
