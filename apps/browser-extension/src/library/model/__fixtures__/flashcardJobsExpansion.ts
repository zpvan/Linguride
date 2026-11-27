/**
 * @file flashcardJobsExpansion.ts
 * @description 职业与工作分类 32 张卡片的精确测试数据
 */

import type { ExpansionEntry } from "./flashcardExpansionTypes";

const B = {
  blue: ["#e2f4ff", "#b9dcf5"], orange: ["#fff0e1", "#ffcfbf"],
  green: ["#e5f8ed", "#bce6cc"], purple: ["#f0e6ff", "#d6c1f5"],
  pink: ["#fff0f5", "#f6c9da"], yellow: ["#fff8d9", "#f3e2a4"],
  cyan: ["#e0f7fa", "#b2ebf2"], gray: ["#f0f0f5", "#d5d5e2"],
  brown: ["#f3eadf", "#dfc3a5"],
} as const;
const i = (cardId: string): ExpansionEntry[1] => ({ kind: "illustration", illustration: cardId });

export const jobsExpansion = [
  ["teacher", i("jobs-teacher"), B.green], ["doctor", i("jobs-doctor"), B.cyan],
  ["nurse", i("jobs-nurse"), B.pink], ["firefighter", i("jobs-firefighter"), B.orange],
  ["police officer", i("jobs-police-officer"), B.blue], ["chef", i("jobs-chef"), B.orange],
  ["baker", i("jobs-baker"), B.yellow], ["farmer", i("jobs-farmer"), B.green],
  ["pilot", i("jobs-pilot"), B.blue], ["flight attendant", i("jobs-flight-attendant"), B.purple],
  ["astronaut", i("jobs-astronaut"), B.purple], ["sailor", i("jobs-sailor"), B.cyan],
  ["fisherman", i("jobs-fisherman"), B.green], ["construction worker", i("jobs-construction-worker"), B.orange],
  ["electrician", i("jobs-electrician"), B.yellow], ["plumber", i("jobs-plumber"), B.blue],
  ["mechanic", i("jobs-mechanic"), B.gray], ["carpenter", i("jobs-carpenter"), B.brown],
  ["painter", i("jobs-painter"), B.pink], ["artist", i("jobs-artist"), B.purple],
  ["musician", i("jobs-musician"), B.purple], ["singer", i("jobs-singer"), B.pink],
  ["dancer", i("jobs-dancer"), B.pink], ["actor", i("jobs-actor"), B.purple],
  ["photographer", i("jobs-photographer"), B.gray], ["journalist", i("jobs-journalist"), B.blue],
  ["writer", i("jobs-writer"), B.brown], ["librarian", i("jobs-librarian"), B.brown],
  ["scientist", i("jobs-scientist"), B.cyan], ["dentist", i("jobs-dentist"), B.cyan],
  ["veterinarian", i("jobs-veterinarian"), B.green], ["mail carrier", i("jobs-mail-carrier"), B.orange],
] satisfies readonly ExpansionEntry[];
