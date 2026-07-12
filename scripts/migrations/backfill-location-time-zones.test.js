const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_LOCATION_TIME_ZONE,
  isValidIanaTimeZone,
  planLocationTimeZoneBackfill,
} = require("./backfill-location-time-zones.js");

test("backfills missing and empty legacy timezones with Sao Paulo", () => {
  for (const data of [{}, { time_zone: null }, { time_zone: "  " }]) {
    assert.deepEqual(planLocationTimeZoneBackfill(data), {
      action: "backfill",
      timeZone: DEFAULT_LOCATION_TIME_ZONE,
      reason: Object.prototype.hasOwnProperty.call(data, "time_zone") ? "empty" : "missing",
    });
  }
});

test("keeps valid IANA zones and is idempotent after backfill", () => {
  for (const timeZone of [DEFAULT_LOCATION_TIME_ZONE, "UTC", "Pacific/Kiritimati", "America/Adak"]) {
    assert.equal(isValidIanaTimeZone(timeZone), true);
    assert.deepEqual(planLocationTimeZoneBackfill({ time_zone: timeZone }), {
      action: "keep",
      timeZone,
      reason: "valid",
    });
  }
});

test("flags invalid stored values for manual review instead of guessing", () => {
  for (const timeZone of [123, "Mars/Olympus_Mons"]) {
    assert.deepEqual(planLocationTimeZoneBackfill({ time_zone: timeZone }), {
      action: "manual-review",
      reason: "invalid",
    });
  }
});
