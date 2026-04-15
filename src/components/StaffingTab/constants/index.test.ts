import { describe, it, expect } from "vitest";
import {
  GRADE_ORDER,
  GRADE_ABBR,
  MAGR_TO_GRADE,
  JOB_CATEGORIES,
  CATEGORY_HIERARCHY,
  MAIN_CATEGORIES,
  getHoursPerDay,
  getGradeColor,
  getGradeAbbr,
  compareGrades,
  isMoreSenior,
  WORK_HOURS_PER_DAY,
  HOURS_PER_DAY,
  MS_PER_DAY,
  GANTT_LEFT_COL_WIDTH,
  ABSENCE_CATS,
  CHARGEABLE_CATS,
  GO_CATS,
  TRAINING_CATS,
  CATEGORY_LABELS,
  getEasterDate,
  generateFrenchHolidays,
  UNKNOWN_GRADE,
  getMainCategory,
} from "./index";
import { GRADE_TARGETS } from "./theme";

describe("GRADE_ORDER", () => {
  it("contains all expected grades in seniority order", () => {
    expect(GRADE_ORDER).toEqual([
      "Partner",
      "Director",
      "Senior Manager",
      "Manager",
      "Senior Consultant",
      "Consultant",
      "Analyst",
      "Intern",
    ]);
  });

  it("has Partner as the most senior (index 0)", () => {
    expect(GRADE_ORDER[0]).toBe("Partner");
  });

  it("has Intern as the least senior (last index)", () => {
    expect(GRADE_ORDER[GRADE_ORDER.length - 1]).toBe("Intern");
  });
});

describe("GRADE_TARGETS", () => {
  it("has a target for each grade in GRADE_ORDER", () => {
    for (const grade of GRADE_ORDER) {
      expect(GRADE_TARGETS[grade]).toBeDefined();
      expect(typeof GRADE_TARGETS[grade]).toBe("number");
      expect(GRADE_TARGETS[grade]).toBeGreaterThan(0);
      expect(GRADE_TARGETS[grade]).toBeLessThanOrEqual(100);
    }
  });

  it("has expected target values for specific grades", () => {
    expect(GRADE_TARGETS["Partner"]).toBe(25);
    expect(GRADE_TARGETS["Director"]).toBe(50);
    expect(GRADE_TARGETS["Senior Manager"]).toBe(65);
    expect(GRADE_TARGETS["Manager"]).toBe(75);
    expect(GRADE_TARGETS["Analyst"]).toBe(90);
    expect(GRADE_TARGETS["Intern"]).toBe(95);
  });

  it("has lower targets for more senior grades", () => {
    expect(GRADE_TARGETS["Partner"]).toBeLessThan(GRADE_TARGETS["Director"]);
    expect(GRADE_TARGETS["Director"]).toBeLessThan(GRADE_TARGETS["Manager"]);
    expect(GRADE_TARGETS["Manager"]).toBeLessThan(GRADE_TARGETS["Analyst"]);
  });
});

describe("GRADE_ABBR", () => {
  it("has an abbreviation for each grade in GRADE_ORDER", () => {
    for (const grade of GRADE_ORDER) {
      expect(GRADE_ABBR[grade]).toBeDefined();
      expect(typeof GRADE_ABBR[grade]).toBe("string");
      expect(GRADE_ABBR[grade].length).toBeGreaterThan(0);
    }
  });

  it("has correct abbreviations for specific grades", () => {
    expect(GRADE_ABBR["Partner"]).toBe("P");
    expect(GRADE_ABBR["Director"]).toBe("Dir");
    expect(GRADE_ABBR["Senior Manager"]).toBe("SM");
    expect(GRADE_ABBR["Manager"]).toBe("M");
    expect(GRADE_ABBR["Senior Consultant"]).toBe("SC");
    expect(GRADE_ABBR["Consultant"]).toBe("C");
    expect(GRADE_ABBR["Analyst"]).toBe("A");
    expect(GRADE_ABBR["Intern"]).toBe("Int");
  });
});

describe("getGradeAbbr", () => {
  it("returns the abbreviation for a known grade", () => {
    expect(getGradeAbbr("Partner")).toBe("P");
    expect(getGradeAbbr("Intern")).toBe("Int");
  });

  it("returns the grade itself for an unknown grade", () => {
    expect(getGradeAbbr("Unknown Grade")).toBe("Unknown Grade");
  });
});

describe("MAGR_TO_GRADE", () => {
  it("starts empty (populated dynamically from var_config.magrProfile)", () => {
    // MAGR_TO_GRADE is populated at hydration, not hardcoded
    expect(typeof MAGR_TO_GRADE).toBe("object");
  });
});

describe("CATEGORY_HIERARCHY", () => {
  it("maps every JOB_CATEGORIES value to a main category", () => {
    // Get unique category values (some aliases map to the same value)
    const uniqueCategories = [...new Set(Object.values(JOB_CATEGORIES))];
    const mainCategoryValues = new Set(Object.values(MAIN_CATEGORIES));

    for (const category of uniqueCategories) {
      expect(CATEGORY_HIERARCHY[category]).toBeDefined();
      expect(mainCategoryValues).toContain(CATEGORY_HIERARCHY[category]);
    }
  });

  it("maps absence sub-categories to ABSENCE", () => {
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.VACATION]).toBe(MAIN_CATEGORIES.ABSENCE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.RTT]).toBe(MAIN_CATEGORIES.ABSENCE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.LOA]).toBe(MAIN_CATEGORIES.ABSENCE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.ILLNESS]).toBe(MAIN_CATEGORIES.ABSENCE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.OTHER_ABSENCE]).toBe(MAIN_CATEGORIES.ABSENCE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.HOLIDAY]).toBe(MAIN_CATEGORIES.ABSENCE);
  });

  it("maps chargeable sub-categories to CHARGEABLE", () => {
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.CHARGEABLE]).toBe(MAIN_CATEGORIES.CHARGEABLE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.GENERAL_OPPTY]).toBe(MAIN_CATEGORIES.CHARGEABLE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.PENDING]).toBe(MAIN_CATEGORIES.CHARGEABLE);
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.OVERTIME]).toBe(MAIN_CATEGORIES.CHARGEABLE);
  });

  it("maps training to TRAINING", () => {
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.TRAINING]).toBe(MAIN_CATEGORIES.TRAINING);
  });

  it("maps reservation to RESERVATION", () => {
    expect(CATEGORY_HIERARCHY[JOB_CATEGORIES.RESERVATION]).toBe(MAIN_CATEGORIES.RESERVATION);
  });
});

describe("getMainCategory", () => {
  it("returns the correct main category for known sub-categories", () => {
    expect(getMainCategory(JOB_CATEGORIES.VACATION)).toBe(MAIN_CATEGORIES.ABSENCE);
    expect(getMainCategory(JOB_CATEGORIES.CHARGEABLE)).toBe(MAIN_CATEGORIES.CHARGEABLE);
    expect(getMainCategory(JOB_CATEGORIES.TRAINING)).toBe(MAIN_CATEGORIES.TRAINING);
  });

  it("returns NON_CHARGEABLE as fallback for unknown sub-categories", () => {
    expect(getMainCategory("nonexistent")).toBe(MAIN_CATEGORIES.NON_CHARGEABLE);
  });
});

describe("getHoursPerDay", () => {
  it("returns 7 for Intern grade", () => {
    expect(getHoursPerDay("Intern")).toBe(7);
  });

  it("returns 8 for all other grades", () => {
    const nonInternGrades = GRADE_ORDER.filter((g) => g !== "Intern");
    for (const grade of nonInternGrades) {
      expect(getHoursPerDay(grade)).toBe(8);
    }
  });

  it("returns 8 when grade is undefined", () => {
    expect(getHoursPerDay(undefined)).toBe(8);
  });

  it("returns 8 for an unrecognized grade string", () => {
    expect(getHoursPerDay("Unknown")).toBe(8);
  });
});

describe("canonical category sets", () => {
  it("ABSENCE_CATS contains all absence sub-categories", () => {
    expect(ABSENCE_CATS.has(JOB_CATEGORIES.VACATION)).toBe(true);
    expect(ABSENCE_CATS.has(JOB_CATEGORIES.RTT)).toBe(true);
    expect(ABSENCE_CATS.has(JOB_CATEGORIES.LOA)).toBe(true);
    expect(ABSENCE_CATS.has(JOB_CATEGORIES.ILLNESS)).toBe(true);
    expect(ABSENCE_CATS.has(JOB_CATEGORIES.OTHER_ABSENCE)).toBe(true);
    expect(ABSENCE_CATS.has(JOB_CATEGORIES.HOLIDAY)).toBe(true);
  });

  it("CHARGEABLE_CATS contains chargeable sub-categories", () => {
    expect(CHARGEABLE_CATS.has(JOB_CATEGORIES.CHARGEABLE)).toBe(true);
    expect(CHARGEABLE_CATS.has(JOB_CATEGORIES.PENDING)).toBe(true);
    expect(CHARGEABLE_CATS.has(JOB_CATEGORIES.OVERTIME)).toBe(true);
  });

  it("GO_CATS contains generalOppty", () => {
    expect(GO_CATS.has(JOB_CATEGORIES.GENERAL_OPPTY)).toBe(true);
  });

  it("TRAINING_CATS contains training", () => {
    expect(TRAINING_CATS.has(JOB_CATEGORIES.TRAINING)).toBe(true);
  });
});

describe("CATEGORY_LABELS", () => {
  it("has a label for every unique JOB_CATEGORIES value", () => {
    const uniqueCategories = [...new Set(Object.values(JOB_CATEGORIES))];
    for (const category of uniqueCategories) {
      expect(CATEGORY_LABELS[category]).toBeDefined();
      expect(typeof CATEGORY_LABELS[category]).toBe("string");
    }
  });
});

describe("compareGrades", () => {
  it("returns negative when first grade is more senior", () => {
    expect(compareGrades("Partner", "Director")).toBeLessThan(0);
    expect(compareGrades("Manager", "Consultant")).toBeLessThan(0);
  });

  it("returns positive when first grade is less senior", () => {
    expect(compareGrades("Intern", "Partner")).toBeGreaterThan(0);
    expect(compareGrades("Analyst", "Manager")).toBeGreaterThan(0);
  });

  it("returns 0 for identical grades", () => {
    expect(compareGrades("Manager", "Manager")).toBe(0);
  });

  it("puts UNKNOWN_GRADE last", () => {
    expect(compareGrades(UNKNOWN_GRADE, "Intern")).toBeGreaterThan(0);
    expect(compareGrades("Partner", UNKNOWN_GRADE)).toBeLessThan(0);
    expect(compareGrades(UNKNOWN_GRADE, UNKNOWN_GRADE)).toBe(0);
  });
});

describe("isMoreSenior", () => {
  it("returns true when a is more senior than b", () => {
    expect(isMoreSenior("Partner", "Director")).toBe(true);
    expect(isMoreSenior("Manager", "Consultant")).toBe(true);
  });

  it("returns false when a is less senior than b", () => {
    expect(isMoreSenior("Intern", "Partner")).toBe(false);
  });

  it("returns false for equal grades", () => {
    expect(isMoreSenior("Manager", "Manager")).toBe(false);
  });
});

describe("getGradeColor", () => {
  it("returns a color object with bg, text, border for known grades", () => {
    for (const grade of GRADE_ORDER) {
      const color = getGradeColor(grade);
      expect(color).toHaveProperty("bg");
      expect(color).toHaveProperty("text");
      expect(color).toHaveProperty("border");
    }
  });

  it("returns a fallback color for unknown grades", () => {
    const color = getGradeColor("SomeNewGrade");
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("text");
    expect(color).toHaveProperty("border");
  });

  it("returns the UNKNOWN_GRADE color for empty string", () => {
    const color = getGradeColor("");
    expect(color).toHaveProperty("bg");
  });
});

describe("getEasterDate", () => {
  it("computes known Easter dates correctly", () => {
    // 2024: March 31
    const e2024 = getEasterDate(2024);
    expect(e2024.getFullYear()).toBe(2024);
    expect(e2024.getMonth()).toBe(2); // March = 2
    expect(e2024.getDate()).toBe(31);

    // 2025: April 20
    const e2025 = getEasterDate(2025);
    expect(e2025.getFullYear()).toBe(2025);
    expect(e2025.getMonth()).toBe(3); // April = 3
    expect(e2025.getDate()).toBe(20);

    // 2026: April 5
    const e2026 = getEasterDate(2026);
    expect(e2026.getFullYear()).toBe(2026);
    expect(e2026.getMonth()).toBe(3); // April = 3
    expect(e2026.getDate()).toBe(5);
  });
});

describe("generateFrenchHolidays", () => {
  it("returns 11 holidays for any given year", () => {
    expect(generateFrenchHolidays(2025).length).toBe(11);
    expect(generateFrenchHolidays(2026).length).toBe(11);
  });

  it("includes fixed-date holidays", () => {
    const holidays2025 = generateFrenchHolidays(2025);
    const dates = holidays2025.map((h) => h.date);
    expect(dates).toContain("2025-01-01"); // New Year
    expect(dates).toContain("2025-05-01"); // Labor Day
    expect(dates).toContain("2025-05-08"); // Victory Day
    expect(dates).toContain("2025-07-14"); // National Day
    expect(dates).toContain("2025-08-15"); // Assumption
    expect(dates).toContain("2025-11-01"); // All Saints
    expect(dates).toContain("2025-11-11"); // Armistice
    expect(dates).toContain("2025-12-25"); // Christmas
  });

  it("each holiday has required fields", () => {
    const holidays = generateFrenchHolidays(2025);
    for (const h of holidays) {
      expect(h).toHaveProperty("id");
      expect(h).toHaveProperty("date");
      expect(h).toHaveProperty("label");
      expect(h).toHaveProperty("year");
      expect(h.year).toBe(2025);
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("numeric constants", () => {
  it("WORK_HOURS_PER_DAY is 8", () => {
    expect(WORK_HOURS_PER_DAY).toBe(8);
  });

  it("HOURS_PER_DAY is 8", () => {
    expect(HOURS_PER_DAY).toBe(8);
  });

  it("MS_PER_DAY is 86400000", () => {
    expect(MS_PER_DAY).toBe(86_400_000);
  });

  it("GANTT_LEFT_COL_WIDTH is 440", () => {
    expect(GANTT_LEFT_COL_WIDTH).toBe(440);
  });
});
