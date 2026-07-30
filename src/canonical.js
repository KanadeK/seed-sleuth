import { createHash } from "node:crypto";

function normalize(value, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError("Canonical JSON does not support circular arrays.");
    }
    seen.add(value);
    const result = value.map((item) => normalize(item, seen));
    seen.delete(value);
    return result;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      throw new TypeError("Canonical JSON does not support circular objects.");
    }
    seen.add(value);
    const result = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item !== undefined) {
        result[key] = normalize(item, seen);
      }
    }
    seen.delete(value);
    return result;
  }

  throw new TypeError(`Canonical JSON does not support values of type ${typeof value}.`);
}

export function canonicalize(value) {
  return JSON.stringify(normalize(value, new Set()));
}

export function fingerprint(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function byteLength(value) {
  return Buffer.byteLength(canonicalize(value), "utf8");
}
